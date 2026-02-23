export {
  BRIDGESOCKET_BRIDGE_PATH_PREFIX,
  BRIDGESOCKET_BRIDGE_REWRITE_SOURCE,
  BRIDGESOCKET_DEV_ADAPTER_NAME,
  BRIDGESOCKET_NEXT_BRIDGE_GLOBAL_KEY,
  appendPlugin,
  attachBridgeToServer,
  attachBridgeToViteServer,
  createBridgeRewriteRoute,
  createBridgeLifecycle,
  createViteBridgeLifecycle,
  ensureStandaloneBridgeSingleton,
  normalizeRewrites,
  resolveAdapterOptions,
  type BridgeLifecycle,
  type BridgeSocketAdapterOptions,
  type BridgeSocketNormalizedRewrites,
  type BridgeSocketRewriteRule,
  type BridgeSocketRewriteSpec,
  type MiddlewareAdapterServer,
  type ViteAdapterServer,
  type ViteBridgeLifecycle,
} from "./adapters/shared/adapter-utils.js";
export {
  createSetupMiddlewaresBridgeLifecycle,
  withBridgeSocketSetupMiddlewares,
} from "./adapters/build/middleware-dev-server.js";
export type {
  SetupMiddlewaresApp,
  SetupMiddlewaresConfig,
  SetupMiddlewaresDevServerLike,
  SetupMiddlewaresHttpServer,
} from "./adapters/build/middleware-dev-server.js";
