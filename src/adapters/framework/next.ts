import type { StandaloneBridgeServer } from "../../bridge/standalone.js";
import {
  DEVSOCKET_NEXT_BRIDGE_GLOBAL_KEY,
  type DevSocketAdapterOptions,
  type DevSocketRewriteSpec,
  createBridgeRewriteRoute,
  ensureStandaloneBridgeSingleton,
  normalizeRewrites,
  resolveAdapterOptions,
} from "../shared/adapter-utils.js";

type MaybePromise<T> = T | Promise<T>;

export type DevSocketNextOptions = DevSocketAdapterOptions;

const NEXT_BRIDGE_GLOBAL_KEY_PREFIX = `${DEVSOCKET_NEXT_BRIDGE_GLOBAL_KEY}:next`;
let nextBridgeInstanceCounter = 0;

function createDefaultNextBridgeGlobalKey(): string {
  nextBridgeInstanceCounter += 1;
  return `${NEXT_BRIDGE_GLOBAL_KEY_PREFIX}:${process.pid}:${nextBridgeInstanceCounter}`;
}

function ensureBridge(
  options: DevSocketNextOptions,
): Promise<StandaloneBridgeServer> {
  return ensureStandaloneBridgeSingleton(options);
}

export function withDevSocketNext<T extends Record<string, unknown>>(
  nextConfig: T,
  options: DevSocketNextOptions = {},
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
    rewrites?: () => MaybePromise<DevSocketRewriteSpec>;
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
