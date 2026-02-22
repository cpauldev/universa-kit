import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import { WebSocket, WebSocketServer } from "ws";

import type { DevSocketRuntimeStatus } from "../types.js";
import { DEVSOCKET_WS_SUBPROTOCOL } from "./constants.js";
import { rejectUpgrade } from "./errors.js";
import type { BridgeEventBus } from "./events.js";
import { getRequestedSubprotocols, isEventsUpgradePath } from "./router.js";
import { toRuntimeWebSocketUrl } from "./state.js";

interface BridgeUpgradeContext {
  bridgePathPrefix: string;
  wss: WebSocketServer;
  eventBus: BridgeEventBus;
  shouldAutoStartRuntime: () => boolean;
  ensureRuntimeStarted: () => Promise<unknown>;
  getRuntimeUrl: () => string | null;
  getRuntimeStatus: () => DevSocketRuntimeStatus;
}

export function handleBridgeUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  context: BridgeUpgradeContext,
): void {
  if (!isEventsUpgradePath(req.url || "/", context.bridgePathPrefix)) {
    return;
  }

  const requestedProtocols = getRequestedSubprotocols(req);
  if (
    requestedProtocols.length > 0 &&
    !requestedProtocols.includes(DEVSOCKET_WS_SUBPROTOCOL)
  ) {
    rejectUpgrade(
      socket,
      426,
      `Unsupported WebSocket subprotocol. Include Sec-WebSocket-Protocol: ${DEVSOCKET_WS_SUBPROTOCOL}.`,
    );
    return;
  }

  context.wss.handleUpgrade(req, socket, head, (ws) => {
    context.wss.emit("connection", ws, req);
    ws.send(
      JSON.stringify(
        context.eventBus.createRuntimeStatusEvent(context.getRuntimeStatus()),
      ),
    );
    void pipeRuntimeEvents(ws, context);
  });
}

async function pipeRuntimeEvents(
  client: WebSocket,
  context: BridgeUpgradeContext,
): Promise<void> {
  if (context.shouldAutoStartRuntime()) {
    try {
      await context.ensureRuntimeStarted();
    } catch (error) {
      context.eventBus.emitRuntimeError(
        error instanceof Error ? error.message : String(error),
      );
      return;
    }
  }

  const runtimeUrl = context.getRuntimeUrl();
  if (!runtimeUrl || client.readyState !== WebSocket.OPEN) {
    return;
  }

  const upstream = new WebSocket(toRuntimeWebSocketUrl(runtimeUrl));
  upstream.on("message", (data, isBinary) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: isBinary });
    }
  });
  upstream.on("error", (error) => {
    context.eventBus.emitRuntimeError(error.message);
  });
  upstream.on("close", () => {
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });

  client.on("message", (data, isBinary) => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(data, { binary: isBinary });
    }
  });
  client.on("close", () => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.close();
    }
  });
}
