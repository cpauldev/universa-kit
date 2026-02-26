export type BridgeSocketRuntimePhase =
  | "stopped"
  | "starting"
  | "running"
  | "stopping"
  | "error";

export type BridgeSocketProtocolVersion = "1";

export interface BridgeSocketRuntimeStatus {
  phase: BridgeSocketRuntimePhase;
  url: string | null;
  pid: number | null;
  startedAt: number | null;
  lastError: string | null;
}

export type BridgeSocketErrorCode =
  | "invalid_request"
  | "route_not_found"
  | "runtime_start_failed"
  | "runtime_control_failed"
  | "runtime_unavailable"
  | "bridge_proxy_failed"
  | "internal_error";

export interface BridgeSocketErrorPayload {
  code: BridgeSocketErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export interface BridgeSocketErrorResponse {
  success: false;
  message: string;
  error: BridgeSocketErrorPayload;
}

export interface BridgeSocketBridgeCapabilities {
  commandHost: "host" | "helper" | "hybrid";
  hasRuntimeControl: boolean;
  canStartRuntime: boolean;
  canRestartRuntime: boolean;
  canStopRuntime: boolean;
  fallbackCommand: string;
  wsSubprotocol: string;
  supportedProtocolVersions: BridgeSocketProtocolVersion[];
}

export interface BridgeSocketBridgeState {
  protocolVersion: BridgeSocketProtocolVersion;
  transportState:
    | "disconnected"
    | "bridge_detecting"
    | "runtime_starting"
    | "connected"
    | "degraded";
  runtime: BridgeSocketRuntimeStatus;
  capabilities: BridgeSocketBridgeCapabilities;
  error?: string;
}

export interface BridgeSocketCommandRequest {
  command:
    | "sync"
    | "login"
    | "logout"
    | "translate"
    | "translate-hashes"
    | "open-file"
    | "save-file"
    | "update-translation";
  payload?: Record<string, unknown>;
}

export interface BridgeSocketCommandResult {
  success: boolean;
  message?: string;
  operationId?: string;
  data?: Record<string, unknown>;
}

interface BridgeSocketBridgeEventBase {
  protocolVersion: BridgeSocketProtocolVersion;
  eventId: number;
  timestamp: number;
}

export type BridgeSocketBridgeEvent =
  | (BridgeSocketBridgeEventBase & {
      type: "runtime-status";
      status: BridgeSocketRuntimeStatus;
    })
  | (BridgeSocketBridgeEventBase & {
      type: "runtime-error";
      error: string;
    });
