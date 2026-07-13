import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import { WebSocketServer } from "ws";

import type { UniversalBridgeState } from "../types.js";
import { UNIVERSAL_WS_SUBPROTOCOL } from "./constants.js";
import { rejectUpgrade } from "./errors.js";
import type { BridgeEventBus } from "./events.js";
import { getRequestedSubprotocols, isEventsUpgradePath } from "./router.js";

interface BridgeUpgradeContext {
  bridgePathPrefix: string;
  wss: WebSocketServer;
  eventBus: BridgeEventBus;
  shouldAutoStartRuntime: () => boolean;
  ensureRuntimeStarted: () => Promise<unknown>;
  getState: () => UniversalBridgeState;
}

export function handleBridgeUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  context: BridgeUpgradeContext,
): void {
  if (!isEventsUpgradePath(req.url || "/", context.bridgePathPrefix)) {
    // Prevent unhandled socket errors if no other listener claims this socket
    socket.once("error", () => {});
    return;
  }

  const requestedProtocols = getRequestedSubprotocols(req);
  if (
    requestedProtocols.length > 0 &&
    !requestedProtocols.includes(UNIVERSAL_WS_SUBPROTOCOL)
  ) {
    rejectUpgrade(
      socket,
      426,
      `Unsupported WebSocket subprotocol. Include Sec-WebSocket-Protocol: ${UNIVERSAL_WS_SUBPROTOCOL}.`,
    );
    return;
  }

  context.wss.handleUpgrade(req, socket, head, (ws) => {
    context.wss.emit("connection", ws, req);
    ws.send(
      JSON.stringify(
        context.eventBus.createBridgeStateEvent(context.getState()),
      ),
    );
    pipeRuntimeEvents(ws, context).catch((error) => {
      context.eventBus.emitBridgeError(
        error instanceof Error ? error.message : String(error),
      );
    });
  });
}

async function pipeRuntimeEvents(
  _client: import("ws").WebSocket,
  context: BridgeUpgradeContext,
): Promise<void> {
  if (context.shouldAutoStartRuntime()) {
    try {
      await context.ensureRuntimeStarted();
    } catch (error) {
      context.eventBus.emitBridgeError(
        error instanceof Error ? error.message : String(error),
      );
      return;
    }
  }

}
