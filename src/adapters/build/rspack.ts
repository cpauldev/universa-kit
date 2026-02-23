import type { BridgeLifecycle, BridgeSocketAdapterOptions } from "../shared/adapter-utils.js";
import {
  createBuildToolBridgeLifecycle,
  withBridgeSocketBuildTool,
  type BuildToolConfig,
  type BuildToolDevServerLike,
} from "./create-build-adapter.js";

export type RspackDevServerLike = BuildToolDevServerLike;
export type RspackConfig<TMiddlewares extends unknown[] = unknown[]> =
  BuildToolConfig<TMiddlewares>;

export type RspackBridgeSocketOptions = BridgeSocketAdapterOptions;

export function createRspackBridgeLifecycle(
  options: RspackBridgeSocketOptions = {},
): BridgeLifecycle {
  return createBuildToolBridgeLifecycle(options);
}

export function withBridgeSocketRspack<
  TMiddlewares extends unknown[],
  TConfig extends RspackConfig<TMiddlewares>,
>(
  config: TConfig,
  options: RspackBridgeSocketOptions = {},
): TConfig & RspackConfig<TMiddlewares> {
  return withBridgeSocketBuildTool<TMiddlewares, RspackDevServerLike, TConfig>(
    config,
    options,
  );
}

