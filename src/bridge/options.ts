import type { RuntimeHelperOptions } from "../runtime/runtime-helper.js";
import {
  BRIDGE_PREFIX_DEFAULT,
  DEFAULT_FALLBACK_COMMAND,
  WS_HEARTBEAT_INTERVAL_MS_DEFAULT,
} from "./constants.js";

export interface DevSocketBridgeOptions extends RuntimeHelperOptions {
  autoStart?: boolean;
  bridgePathPrefix?: string;
  fallbackCommand?: string;
  eventHeartbeatIntervalMs?: number;
}

export type ResolvedBridgeOptions = Required<
  Pick<
    DevSocketBridgeOptions,
    | "autoStart"
    | "bridgePathPrefix"
    | "fallbackCommand"
    | "eventHeartbeatIntervalMs"
  >
> &
  Omit<
    DevSocketBridgeOptions,
    | "autoStart"
    | "bridgePathPrefix"
    | "fallbackCommand"
    | "eventHeartbeatIntervalMs"
  >;

export function resolveBridgeOptions(
  options: DevSocketBridgeOptions,
): ResolvedBridgeOptions {
  return {
    autoStart: options.autoStart ?? true,
    bridgePathPrefix: options.bridgePathPrefix ?? BRIDGE_PREFIX_DEFAULT,
    fallbackCommand: options.fallbackCommand ?? DEFAULT_FALLBACK_COMMAND,
    eventHeartbeatIntervalMs:
      options.eventHeartbeatIntervalMs ?? WS_HEARTBEAT_INTERVAL_MS_DEFAULT,
    ...options,
  };
}
