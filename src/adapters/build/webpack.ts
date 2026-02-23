import type { BridgeLifecycle, BridgeSocketAdapterOptions } from "../shared/adapter-utils.js";
import {
  createBuildToolBridgeLifecycle,
  withBridgeSocketBuildTool,
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

export type WebpackBridgeSocketOptions = BridgeSocketAdapterOptions;

export function createWebpackBridgeLifecycle(
  options: WebpackBridgeSocketOptions = {},
): BridgeLifecycle {
  return createBuildToolBridgeLifecycle(options);
}

export function withBridgeSocketWebpackDevServer<
  TMiddlewares extends unknown[],
  TConfig extends WebpackDevServerConfig<TMiddlewares>,
>(
  config: TConfig,
  options: WebpackBridgeSocketOptions = {},
): TConfig & WebpackDevServerConfig<TMiddlewares> {
  return withBridgeSocketBuildTool<TMiddlewares, WebpackDevServerLike, TConfig>(
    config,
    options,
  );
}

