import type { StandaloneBridgeServer } from "../../bridge/standalone.js";
import {
  BRIDGESOCKET_NEXT_BRIDGE_GLOBAL_KEY,
  type BridgeSocketAdapterOptions,
  type BridgeSocketRewriteSpec,
  createBridgeRewriteRoute,
  ensureStandaloneBridgeSingleton,
  normalizeRewrites,
  resolveAdapterOptions,
} from "../shared/adapter-utils.js";

type MaybePromise<T> = T | Promise<T>;

export type BridgeSocketNextOptions = BridgeSocketAdapterOptions;

const NEXT_BRIDGE_GLOBAL_KEY_PREFIX = `${BRIDGESOCKET_NEXT_BRIDGE_GLOBAL_KEY}:next`;
let nextBridgeInstanceCounter = 0;

function createDefaultNextBridgeGlobalKey(): string {
  nextBridgeInstanceCounter += 1;
  return `${NEXT_BRIDGE_GLOBAL_KEY_PREFIX}:${process.pid}:${nextBridgeInstanceCounter}`;
}

function ensureBridge(
  options: BridgeSocketNextOptions,
): Promise<StandaloneBridgeServer> {
  return ensureStandaloneBridgeSingleton(options);
}

export function withBridgeSocketNext<T extends object>(
  nextConfig: T,
  options: BridgeSocketNextOptions = {},
): T {
  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev) {
    return nextConfig;
  }

  const resolvedOptions = resolveAdapterOptions(options);
  const nextBridgeGlobalKey =
    options.nextBridgeGlobalKey ?? createDefaultNextBridgeGlobalKey();
  const bridgeOptions = { ...resolvedOptions, nextBridgeGlobalKey };
  const next = { ...nextConfig } as T & {
    rewrites?: () => MaybePromise<BridgeSocketRewriteSpec>;
  };
  const originalRewrites = next.rewrites;

  next.rewrites = async () => {
    const bridge = await ensureBridge(bridgeOptions);
    const route = createBridgeRewriteRoute(
      bridge.baseUrl,
      bridgeOptions.rewriteSource,
    );
    const existing = originalRewrites ? await originalRewrites() : undefined;
    const normalized = normalizeRewrites(existing);

    return {
      beforeFiles: [route, ...normalized.beforeFiles],
      afterFiles: normalized.afterFiles,
      fallback: normalized.fallback,
    };
  };

  return next;
}
