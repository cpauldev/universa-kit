import type { RuntimeHelperOptions } from "../runtime/runtime-helper.js";
import type { UniversaBridgeInstance } from "../types.js";
import {
  DEFAULT_FALLBACK_COMMAND,
  WS_HEARTBEAT_INTERVAL_MS_DEFAULT,
} from "./constants.js";
import { normalizeBridgePathPrefix } from "./prefix.js";

export interface UniversaBridgeOptions extends RuntimeHelperOptions {
  autoStart?: boolean;
  bridgePathPrefix?: string;
  fallbackCommand?: string;
  eventHeartbeatIntervalMs?: number;
  proxyRuntimeWebSocket?: boolean;
  instance?: UniversaBridgeInstance;
  /** Additional URL path prefixes to proxy directly to the runtime (e.g. ["/dashboard"]). */
  additionalProxyPaths?: string[];
}

export type ResolvedBridgeOptions = Required<
  Pick<
    UniversaBridgeOptions,
    | "autoStart"
    | "bridgePathPrefix"
    | "fallbackCommand"
    | "eventHeartbeatIntervalMs"
    | "proxyRuntimeWebSocket"
  >
> &
  Omit<
    UniversaBridgeOptions,
    | "autoStart"
    | "bridgePathPrefix"
    | "fallbackCommand"
    | "eventHeartbeatIntervalMs"
    | "proxyRuntimeWebSocket"
  >;

export function resolveBridgeOptions(
  options: UniversaBridgeOptions,
): ResolvedBridgeOptions {
  return {
    ...options,
    autoStart: options.autoStart ?? true,
    bridgePathPrefix: normalizeBridgePathPrefix(options.bridgePathPrefix),
    fallbackCommand: options.fallbackCommand ?? DEFAULT_FALLBACK_COMMAND,
    eventHeartbeatIntervalMs:
      options.eventHeartbeatIntervalMs ?? WS_HEARTBEAT_INTERVAL_MS_DEFAULT,
    proxyRuntimeWebSocket: options.proxyRuntimeWebSocket ?? true,
  };
}
