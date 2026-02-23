import { WebSocket, WebSocketServer } from "ws";

import type {
  BridgeSocketBridgeEvent,
  BridgeSocketRuntimeStatus,
} from "../types.js";
import { BRIDGESOCKET_PROTOCOL_VERSION } from "./constants.js";

interface EventClientState {
  isAlive: boolean;
}

export class BridgeEventBus {
  #eventClients = new Set<WebSocket>();
  #eventClientState = new Map<WebSocket, EventClientState>();
  #heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  #nextEventId = 1;

  constructor(heartbeatIntervalMs: number) {
    this.startHeartbeatLoop(heartbeatIntervalMs);
  }

  attachToWebSocketServer(wss: WebSocketServer): void {
    wss.on("connection", (socket) => this.registerEventClient(socket));
  }

  createRuntimeStatusEvent(
    status: BridgeSocketRuntimeStatus,
  ): BridgeSocketBridgeEvent {
    return this.createBridgeEvent({
      type: "runtime-status",
      status,
    });
  }

  emitRuntimeStatus(status: BridgeSocketRuntimeStatus): void {
    this.emitEvent(this.createRuntimeStatusEvent(status));
  }

  emitRuntimeError(error: string): void {
    this.emitEvent(
      this.createBridgeEvent({
        type: "runtime-error",
        error,
      }),
    );
  }

  close(): void {
    for (const socket of this.#eventClients) {
      socket.close();
    }
    this.#eventClients.clear();
    this.#eventClientState.clear();
    this.stopHeartbeatLoop();
  }

  private emitEvent(event: BridgeSocketBridgeEvent): void {
    const payload = JSON.stringify(event);
    for (const client of this.#eventClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  private createBridgeEvent(
    event:
      | {
          type: "runtime-status";
          status: BridgeSocketRuntimeStatus;
        }
      | {
          type: "runtime-error";
          error: string;
        },
  ): BridgeSocketBridgeEvent {
    return {
      ...event,
      protocolVersion: BRIDGESOCKET_PROTOCOL_VERSION,
      eventId: this.#nextEventId++,
      timestamp: Date.now(),
    };
  }

  private registerEventClient(socket: WebSocket): void {
    this.#eventClients.add(socket);
    this.#eventClientState.set(socket, { isAlive: true });

    socket.on("pong", () => {
      const state = this.#eventClientState.get(socket);
      if (state) {
        state.isAlive = true;
      }
    });

    socket.on("close", () => {
      this.unregisterEventClient(socket);
    });

    socket.on("error", () => {
      this.unregisterEventClient(socket);
    });
  }

  private unregisterEventClient(socket: WebSocket): void {
    this.#eventClients.delete(socket);
    this.#eventClientState.delete(socket);
  }

  private startHeartbeatLoop(intervalMs: number): void {
    this.#heartbeatTimer = setInterval(() => {
      for (const socket of this.#eventClients) {
        if (socket.readyState !== WebSocket.OPEN) {
          this.unregisterEventClient(socket);
          continue;
        }

        const state = this.#eventClientState.get(socket);
        if (!state) {
          continue;
        }

        if (!state.isAlive) {
          socket.terminate();
          this.unregisterEventClient(socket);
          continue;
        }

        state.isAlive = false;
        socket.ping();
      }
    }, intervalMs);

    this.#heartbeatTimer.unref?.();
  }

  private stopHeartbeatLoop(): void {
    if (!this.#heartbeatTimer) {
      return;
    }

    clearInterval(this.#heartbeatTimer);
    this.#heartbeatTimer = null;
  }
}
