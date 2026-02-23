import type {
  BridgeLifecycle,
  BridgeSocketAdapterOptions,
} from "../shared/adapter-utils.js";
import {
  createSetupMiddlewaresBridgeLifecycle,
  withBridgeSocketSetupMiddlewares,
  type SetupMiddlewaresConfig,
  type SetupMiddlewaresDevServerLike,
} from "./middleware-dev-server.js";

export type BuildToolDevServerLike = SetupMiddlewaresDevServerLike;
export type BuildToolConfig<TMiddlewares extends unknown[] = unknown[]> =
  SetupMiddlewaresConfig<TMiddlewares, BuildToolDevServerLike>;
export type BuildToolBridgeSocketOptions = BridgeSocketAdapterOptions;

export function createBuildToolBridgeLifecycle(
  options: BuildToolBridgeSocketOptions = {},
): BridgeLifecycle {
  return createSetupMiddlewaresBridgeLifecycle(options);
}

export function withBridgeSocketBuildTool<
  TMiddlewares extends unknown[],
  TDevServer extends BuildToolDevServerLike,
  TConfig extends SetupMiddlewaresConfig<TMiddlewares, TDevServer>,
>(
  config: TConfig,
  options: BuildToolBridgeSocketOptions = {},
): TConfig & SetupMiddlewaresConfig<TMiddlewares, TDevServer> {
  return withBridgeSocketSetupMiddlewares<TMiddlewares, TDevServer, TConfig>(
    config,
    options,
  );
}

