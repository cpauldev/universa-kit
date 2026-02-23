import type {
  BridgeSocketBridgeCapabilities,
  BridgeSocketBridgeState,
  BridgeSocketRuntimeStatus,
} from "../types.js";
import {
  BRIDGESOCKET_PROTOCOL_VERSION,
  BRIDGESOCKET_WS_SUBPROTOCOL,
} from "./constants.js";

export function createCapabilities(
  fallbackCommand: string,
  hasRuntimeControl: boolean,
  commandHost: BridgeSocketBridgeCapabilities["commandHost"],
): BridgeSocketBridgeCapabilities {
  return {
    commandHost,
    hasRuntimeControl,
    canStartRuntime: hasRuntimeControl,
    canRestartRuntime: hasRuntimeControl,
    canStopRuntime: hasRuntimeControl,
    fallbackCommand,
    wsSubprotocol: BRIDGESOCKET_WS_SUBPROTOCOL,
    supportedProtocolVersions: [BRIDGESOCKET_PROTOCOL_VERSION],
  };
}

export function toTransportState(
  runtime: BridgeSocketRuntimeStatus,
): BridgeSocketBridgeState["transportState"] {
  switch (runtime.phase) {
    case "running":
      return "connected";
    case "starting":
      return "runtime_starting";
    case "error":
      return "degraded";
    case "stopped":
    case "stopping":
    default:
      return "bridge_detecting";
  }
}

export function toRuntimeWebSocketUrl(runtimeUrl: string): string {
  if (runtimeUrl.startsWith("https://")) {
    return `wss://${runtimeUrl.slice("https://".length)}`;
  }
  if (runtimeUrl.startsWith("http://")) {
    return `ws://${runtimeUrl.slice("http://".length)}`;
  }
  return `ws://${runtimeUrl}`;
}
