import {
  type UniversaBridge,
  type UniversaBridgeOptions,
  createUniversaBridge,
} from "../../bridge/bridge.js";
import {
  buildBridgeRewriteSource,
  normalizeBridgePathPrefix,
} from "../../bridge/prefix.js";
import type { BridgeMiddlewareServer } from "../../bridge/server-types.js";
import {
  type StandaloneBridgeServer,
  startStandaloneUniversaBridgeServer,
} from "../../bridge/standalone.js";
import type { UniversaClientRuntimeContext } from "../../client/runtime-context.js";

export const UNIVERSA_DEV_ADAPTER_NAME = "universa-bridge";
export const UNIVERSA_BRIDGE_PATH_PREFIX = "/__universa";
export const UNIVERSA_BRIDGE_REWRITE_SOURCE = "/__universa/:path*";
export const UNIVERSA_NEXT_BRIDGE_GLOBAL_KEY = "__UNIVERSA_NEXT_BRIDGE__";

export interface UniversaRewriteRule {
  source: string;
  destination: string;
}

export type UniversaRewriteSpec =
  | UniversaRewriteRule[]
  | {
      beforeFiles?: UniversaRewriteRule[];
      afterFiles?: UniversaRewriteRule[];
      fallback?: UniversaRewriteRule[];
    };

export interface UniversaNormalizedRewrites {
  beforeFiles: UniversaRewriteRule[];
  afterFiles: UniversaRewriteRule[];
  fallback: UniversaRewriteRule[];
}

export interface UniversaAdapterOptions extends UniversaBridgeOptions {
  adapterName?: string;
  rewriteSource?: string;
  nextBridgeGlobalKey?: string;
  /** Package specifier for the client module to auto-inject (e.g. "example/overlay"). */
  clientModule?: string;
  /** Controls whether adapter-level client injection is enabled. */
  clientEnabled?: boolean;
  /** Controls whether client modules should auto-mount once injected. */
  clientAutoMount?: boolean;
  /** Optional namespaced context published to client modules before loading. */
  clientRuntimeContext?: UniversaClientRuntimeContext;
  /** Stable namespace id for collision-proof adapter internals. */
  namespaceId?: string;
  /** Internal framework-level activation guard used by preset composition. */
  _frameworkIsActive?: () => boolean;
}

interface ResolvedUniversaAdapterOptions extends UniversaBridgeOptions {
  adapterName: string;
  rewriteSource: string;
  nextBridgeGlobalKey?: string;
  clientModule?: string;
  clientEnabled: boolean;
  clientAutoMount: boolean;
  clientRuntimeContext?: UniversaClientRuntimeContext;
  namespaceId?: string;
  _frameworkIsActive?: () => boolean;
}

export type MiddlewareAdapterServer = BridgeMiddlewareServer;

export interface BridgeLifecycle {
  setup: (server: MiddlewareAdapterServer) => Promise<UniversaBridge>;
  teardown: () => Promise<void>;
  getBridge: () => UniversaBridge | null;
}

export type ViteAdapterServer = MiddlewareAdapterServer;
export type ViteBridgeLifecycle = BridgeLifecycle;

export function resolveAdapterOptions(
  options: UniversaAdapterOptions = {},
): ResolvedUniversaAdapterOptions {
  const bridgePathPrefix = normalizeBridgePathPrefix(options.bridgePathPrefix);

  return {
    ...options,
    adapterName: options.adapterName ?? UNIVERSA_DEV_ADAPTER_NAME,
    bridgePathPrefix,
    rewriteSource: buildBridgeRewriteSource(bridgePathPrefix),
    nextBridgeGlobalKey: options.nextBridgeGlobalKey,
    clientModule: options.clientModule,
    clientEnabled: options.clientEnabled ?? true,
    clientAutoMount: options.clientAutoMount ?? true,
    clientRuntimeContext: options.clientRuntimeContext,
    namespaceId: options.namespaceId,
    _frameworkIsActive: options._frameworkIsActive,
  };
}

function toBridgeOptions(
  options: UniversaAdapterOptions,
): UniversaBridgeOptions {
  const {
    adapterName: _adapterName,
    rewriteSource: _rewriteSource,
    nextBridgeGlobalKey: _nextBridgeGlobalKey,
    clientModule: _clientModule,
    clientEnabled: _clientEnabled,
    clientAutoMount: _clientAutoMount,
    clientRuntimeContext: _clientRuntimeContext,
    namespaceId: _namespaceId,
    _frameworkIsActive: _frameworkIsActive,
    ...bridgeOptions
  } = options;
  return bridgeOptions;
}

export async function attachBridgeToServer(
  server: MiddlewareAdapterServer,
  options: UniversaAdapterOptions,
): Promise<UniversaBridge> {
  const bridge = await createUniversaBridge(toBridgeOptions(options));
  await bridge.attach(server);
  return bridge;
}

export function attachBridgeToViteServer(
  server: ViteAdapterServer,
  options: UniversaAdapterOptions,
): Promise<UniversaBridge> {
  return attachBridgeToServer(server, options);
}

export function createBridgeLifecycle(
  options: UniversaAdapterOptions = {},
): BridgeLifecycle {
  const resolvedOptions = resolveAdapterOptions(options);
  let bridge: UniversaBridge | null = null;
  let setupPromise: Promise<UniversaBridge> | null = null;

  return {
    async setup(server) {
      if (setupPromise) {
        return setupPromise;
      }

      setupPromise = (async () => {
        if (bridge?.isClosed()) {
          bridge = null;
        }

        if (!bridge) {
          bridge = await createUniversaBridge(toBridgeOptions(resolvedOptions));
          await bridge.attach(server);
        }

        return bridge;
      })();

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
  options: UniversaAdapterOptions = {},
): ViteBridgeLifecycle {
  return createBridgeLifecycle(options);
}

export function ensureStandaloneBridgeSingleton(
  options: UniversaAdapterOptions,
): Promise<StandaloneBridgeServer> {
  const resolvedOptions = resolveAdapterOptions(options);
  const bridgeGlobal = globalThis as typeof globalThis & {
    [key: string]: Promise<StandaloneBridgeServer> | undefined;
  };
  const globalKey =
    resolvedOptions.nextBridgeGlobalKey ?? UNIVERSA_NEXT_BRIDGE_GLOBAL_KEY;

  if (!bridgeGlobal[globalKey]) {
    const startupPromise = startStandaloneUniversaBridgeServer(
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
    throw new Error("Failed to initialize standalone universa-kit bridge");
  }

  return bridge;
}

export function normalizeRewrites(
  rewrites: UniversaRewriteSpec | undefined,
): UniversaNormalizedRewrites {
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
  rewriteSource = UNIVERSA_BRIDGE_REWRITE_SOURCE,
): UniversaRewriteRule {
  const normalizedSource = buildBridgeRewriteSource(
    rewriteSource.replace(/\/:path\*$/, ""),
  );
  return {
    source: normalizedSource,
    destination: `${baseUrl}${normalizedSource}`,
  };
}

export function appendPlugin<T>(plugins: T[] | undefined, plugin: T): T[] {
  return [...(plugins ?? []), plugin];
}

export function createClientBootstrapVirtualIds(namespaceId: string): {
  virtualId: string;
  resolvedVirtualId: string;
  publicSpecifier: string;
} {
  const virtualId = `universa-kit:client-init:${namespaceId}`;
  return {
    virtualId,
    resolvedVirtualId: `\0${virtualId}`,
    publicSpecifier: `/@id/${virtualId}`,
  };
}

export function buildClientRuntimeContextRegistration(
  clientModule: string,
  context?: UniversaClientRuntimeContext,
): string[] {
  if (!context) return [];

  return [
    `globalThis.__UNIVERSA_CLIENT_RUNTIME_CONTEXTS__ ??= {};`,
    `globalThis.__UNIVERSA_CLIENT_RUNTIME_CONTEXTS__[${JSON.stringify(clientModule)}] = ${JSON.stringify(context)};`,
  ];
}

export function buildClientBootstrapModuleSource(options: {
  clientModule: string;
  clientRuntimeContext?: UniversaClientRuntimeContext;
  acceptHotUpdate?: boolean;
  footerLines?: string[];
}): string {
  const lines = buildClientRuntimeContextRegistration(
    options.clientModule,
    options.clientRuntimeContext,
  );

  lines.push(`import ${JSON.stringify(options.clientModule)};`);

  if (options.acceptHotUpdate) {
    lines.push(`if (import.meta.hot) { import.meta.hot.accept(() => {}); }`);
  }

  if (options.footerLines?.length) {
    lines.push(...options.footerLines);
  }

  return lines.join("\n");
}
