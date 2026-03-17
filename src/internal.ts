export {
  UNIVERSA_BRIDGE_PATH_PREFIX,
  UNIVERSA_BRIDGE_REWRITE_SOURCE,
  UNIVERSA_DEV_ADAPTER_NAME,
  UNIVERSA_NEXT_BRIDGE_GLOBAL_KEY,
  appendPlugin,
  attachBridgeToServer,
  attachBridgeToViteServer,
  createBridgeRewriteRoute,
  createDirectRewriteRoute,
  createBridgeLifecycle,
  createViteBridgeLifecycle,
  ensureStandaloneBridgeSingleton,
  normalizeRewrites,
  resolveAdapterOptions,
  type BridgeLifecycle,
  type UniversaAdapterOptions,
  type UniversaNormalizedRewrites,
  type UniversaRewriteRule,
  type UniversaRewriteSpec,
  type MiddlewareAdapterServer,
  type ViteAdapterServer,
  type ViteBridgeLifecycle,
} from "./adapters/shared/adapter-utils.js";
export {
  createSetupMiddlewaresBridgeLifecycle,
  withUniversaSetupMiddlewares,
} from "./adapters/build/middleware-dev-server.js";
export type {
  SetupMiddlewaresApp,
  SetupMiddlewaresConfig,
  SetupMiddlewaresDevServerLike,
  SetupMiddlewaresHttpServer,
} from "./adapters/build/middleware-dev-server.js";
