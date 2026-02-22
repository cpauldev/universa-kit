import type { BridgeLifecycle, DevSocketAdapterOptions } from "../shared/adapter-utils.js";
import {
  createBuildToolBridgeLifecycle,
  withDevSocketBuildTool,
  type BuildToolConfig,
  type BuildToolDevServerLike,
} from "./create-build-adapter.js";
import type {
  SetupMiddlewaresApp,
  SetupMiddlewaresHttpServer,
} from "./middleware-dev-server.js";

export type WebpackLikeApp = SetupMiddlewaresApp;
export type WebpackLikeHttpServer = SetupMiddlewaresHttpServer;
export type WebpackDevServerLike = BuildToolDevServerLike;
export type WebpackDevServerConfig<TMiddlewares extends unknown[] = unknown[]> =
  BuildToolConfig<TMiddlewares>;

export type WebpackDevSocketOptions = DevSocketAdapterOptions;

export function createWebpackBridgeLifecycle(
  options: WebpackDevSocketOptions = {},
): BridgeLifecycle {
  return createBuildToolBridgeLifecycle(options);
}

export function withDevSocketWebpackDevServer<
  TMiddlewares extends unknown[],
  TConfig extends WebpackDevServerConfig<TMiddlewares>,
>(
  config: TConfig,
  options: WebpackDevSocketOptions = {},
): TConfig & WebpackDevServerConfig<TMiddlewares> {
  return withDevSocketBuildTool<TMiddlewares, WebpackDevServerLike, TConfig>(
    config,
    options,
  );
}
