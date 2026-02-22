import type { BridgeLifecycle, DevSocketAdapterOptions } from "../shared/adapter-utils.js";
import {
  createBuildToolBridgeLifecycle,
  withDevSocketBuildTool,
  type BuildToolConfig,
  type BuildToolDevServerLike,
} from "./create-build-adapter.js";

export type RspackDevServerLike = BuildToolDevServerLike;
export type RspackConfig<TMiddlewares extends unknown[] = unknown[]> =
  BuildToolConfig<TMiddlewares>;

export type RspackDevSocketOptions = DevSocketAdapterOptions;

export function createRspackBridgeLifecycle(
  options: RspackDevSocketOptions = {},
): BridgeLifecycle {
  return createBuildToolBridgeLifecycle(options);
}

export function withDevSocketRspack<
  TMiddlewares extends unknown[],
  TConfig extends RspackConfig<TMiddlewares>,
>(
  config: TConfig,
  options: RspackDevSocketOptions = {},
): TConfig & RspackConfig<TMiddlewares> {
  return withDevSocketBuildTool<TMiddlewares, RspackDevServerLike, TConfig>(
    config,
    options,
  );
}
