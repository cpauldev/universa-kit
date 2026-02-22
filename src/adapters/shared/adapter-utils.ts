import {
  type DevSocketBridge,
  type DevSocketBridgeOptions,
  createDevSocketBridge,
} from "../../bridge/bridge.js";
import type { BridgeMiddlewareServer } from "../../bridge/server-types.js";
import {
  type StandaloneBridgeServer,
  startStandaloneDevSocketBridgeServer,
} from "../../bridge/standalone.js";

export const DEVSOCKET_DEV_ADAPTER_NAME = "devsocket-bridge";
export const DEVSOCKET_BRIDGE_PATH_PREFIX = "/__devsocket";
export const DEVSOCKET_BRIDGE_REWRITE_SOURCE = "/__devsocket/:path*";
export const DEVSOCKET_NEXT_BRIDGE_GLOBAL_KEY = "__DEVSOCKET_NEXT_BRIDGE__";

export interface DevSocketRewriteRule {
  source: string;
  destination: string;
}

export type DevSocketRewriteSpec =
  | DevSocketRewriteRule[]
  | {
      beforeFiles?: DevSocketRewriteRule[];
      afterFiles?: DevSocketRewriteRule[];
      fallback?: DevSocketRewriteRule[];
    };

export interface DevSocketNormalizedRewrites {
  beforeFiles: DevSocketRewriteRule[];
  afterFiles: DevSocketRewriteRule[];
  fallback: DevSocketRewriteRule[];
}

export interface DevSocketAdapterOptions extends DevSocketBridgeOptions {
  adapterName?: string;
  rewriteSource?: string;
  nextBridgeGlobalKey?: string;
}

interface ResolvedDevSocketAdapterOptions extends DevSocketBridgeOptions {
  adapterName: string;
  rewriteSource: string;
  nextBridgeGlobalKey?: string;
}

export type MiddlewareAdapterServer = BridgeMiddlewareServer;

export interface BridgeLifecycle {
  setup: (server: MiddlewareAdapterServer) => Promise<DevSocketBridge>;
  teardown: () => Promise<void>;
  getBridge: () => DevSocketBridge | null;
}

export type ViteAdapterServer = MiddlewareAdapterServer;
export type ViteBridgeLifecycle = BridgeLifecycle;

export function resolveAdapterOptions(
  options: DevSocketAdapterOptions = {},
): ResolvedDevSocketAdapterOptions {
  return {
    ...options,
    adapterName: options.adapterName ?? DEVSOCKET_DEV_ADAPTER_NAME,
    bridgePathPrefix: options.bridgePathPrefix ?? DEVSOCKET_BRIDGE_PATH_PREFIX,
    rewriteSource: options.rewriteSource ?? DEVSOCKET_BRIDGE_REWRITE_SOURCE,
    nextBridgeGlobalKey: options.nextBridgeGlobalKey,
  };
}

function toBridgeOptions(
  options: DevSocketAdapterOptions,
): DevSocketBridgeOptions {
  const {
    adapterName: _adapterName,
    rewriteSource: _rewriteSource,
    nextBridgeGlobalKey: _nextBridgeGlobalKey,
    ...bridgeOptions
  } = options;
  return bridgeOptions;
}

export async function attachBridgeToServer(
  server: MiddlewareAdapterServer,
  options: DevSocketAdapterOptions,
): Promise<DevSocketBridge> {
  const bridge = await createDevSocketBridge(toBridgeOptions(options));
  await bridge.attach(server);
  return bridge;
}

export function attachBridgeToViteServer(
  server: ViteAdapterServer,
  options: DevSocketAdapterOptions,
): Promise<DevSocketBridge> {
  return attachBridgeToServer(server, options);
}

export function createBridgeLifecycle(
  options: DevSocketAdapterOptions = {},
): BridgeLifecycle {
  const resolvedOptions = resolveAdapterOptions(options);
  let bridge: DevSocketBridge | null = null;
  let setupPromise: Promise<DevSocketBridge> | null = null;

  return {
    async setup(server) {
      if (bridge) {
        return bridge;
      }
      if (setupPromise) {
        return setupPromise;
      }

      setupPromise = attachBridgeToServer(server, resolvedOptions).then(
        (createdBridge) => {
          bridge = createdBridge;
          return createdBridge;
        },
      );

      try {
        return await setupPromise;
      } finally {
        setupPromise = null;
      }
    },
    async teardown() {
      let currentBridge = bridge;
      if (!currentBridge && setupPromise) {
        try {
          currentBridge = await setupPromise;
        } catch {
          currentBridge = null;
        }
      }

      bridge = null;
      setupPromise = null;

      if (currentBridge) {
        await currentBridge.close();
      }
    },
    getBridge() {
      return bridge;
    },
  };
}

export function createViteBridgeLifecycle(
  options: DevSocketAdapterOptions = {},
): ViteBridgeLifecycle {
  return createBridgeLifecycle(options);
}

export function ensureStandaloneBridgeSingleton(
  options: DevSocketAdapterOptions,
): Promise<StandaloneBridgeServer> {
  const resolvedOptions = resolveAdapterOptions(options);
  const bridgeGlobal = globalThis as typeof globalThis & {
    [key: string]: Promise<StandaloneBridgeServer> | undefined;
  };
  const globalKey =
    resolvedOptions.nextBridgeGlobalKey ?? DEVSOCKET_NEXT_BRIDGE_GLOBAL_KEY;

  if (!bridgeGlobal[globalKey]) {
    const startupPromise = startStandaloneDevSocketBridgeServer(
      toBridgeOptions(resolvedOptions),
    );
    const guardedPromise = startupPromise.catch((error) => {
      if (bridgeGlobal[globalKey] === guardedPromise) {
        delete bridgeGlobal[globalKey];
      }
      throw error;
    });
    bridgeGlobal[globalKey] = guardedPromise;
  }

  const bridge = bridgeGlobal[globalKey];
  if (!bridge) {
    throw new Error("Failed to initialize standalone devsocket bridge");
  }

  return bridge;
}

export function normalizeRewrites(
  rewrites: DevSocketRewriteSpec | undefined,
): DevSocketNormalizedRewrites {
  if (!rewrites) {
    return { beforeFiles: [], afterFiles: [], fallback: [] };
  }

  if (Array.isArray(rewrites)) {
    return { beforeFiles: rewrites, afterFiles: [], fallback: [] };
  }

  return {
    beforeFiles: rewrites.beforeFiles ?? [],
    afterFiles: rewrites.afterFiles ?? [],
    fallback: rewrites.fallback ?? [],
  };
}

export function createBridgeRewriteRoute(
  baseUrl: string,
  rewriteSource = DEVSOCKET_BRIDGE_REWRITE_SOURCE,
): DevSocketRewriteRule {
  return {
    source: rewriteSource,
    destination: `${baseUrl}${rewriteSource}`,
  };
}

export function appendPlugin<T>(plugins: T[] | undefined, plugin: T): T[] {
  return [...(plugins ?? []), plugin];
}
