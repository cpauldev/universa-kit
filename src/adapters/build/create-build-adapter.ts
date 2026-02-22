import type {
  BridgeLifecycle,
  DevSocketAdapterOptions,
} from "../shared/adapter-utils.js";
import {
  createSetupMiddlewaresBridgeLifecycle,
  withDevSocketSetupMiddlewares,
  type SetupMiddlewaresConfig,
  type SetupMiddlewaresDevServerLike,
} from "./middleware-dev-server.js";

export type BuildToolDevServerLike = SetupMiddlewaresDevServerLike;
export type BuildToolConfig<TMiddlewares extends unknown[] = unknown[]> =
  SetupMiddlewaresConfig<TMiddlewares, BuildToolDevServerLike>;
export type BuildToolDevSocketOptions = DevSocketAdapterOptions;

export function createBuildToolBridgeLifecycle(
  options: BuildToolDevSocketOptions = {},
): BridgeLifecycle {
  return createSetupMiddlewaresBridgeLifecycle(options);
}

export function withDevSocketBuildTool<
  TMiddlewares extends unknown[],
  TDevServer extends BuildToolDevServerLike,
  TConfig extends SetupMiddlewaresConfig<TMiddlewares, TDevServer>,
>(
  config: TConfig,
  options: BuildToolDevSocketOptions = {},
): TConfig & SetupMiddlewaresConfig<TMiddlewares, TDevServer> {
  return withDevSocketSetupMiddlewares<TMiddlewares, TDevServer, TConfig>(
    config,
    options,
  );
}
