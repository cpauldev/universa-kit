import type { BridgeLifecycle, DevSocketAdapterOptions } from "../shared/adapter-utils.js";
import {
  createBuildToolBridgeLifecycle,
  withDevSocketBuildTool,
  type BuildToolConfig,
  type BuildToolDevServerLike,
} from "./create-build-adapter.js";

export type RsbuildDevServerLike = BuildToolDevServerLike;
export type RsbuildConfig<TMiddlewares extends unknown[] = unknown[]> =
  BuildToolConfig<TMiddlewares>;

export type RsbuildDevSocketOptions = DevSocketAdapterOptions;

export function createRsbuildBridgeLifecycle(
  options: RsbuildDevSocketOptions = {},
): BridgeLifecycle {
  return createBuildToolBridgeLifecycle(options);
}

export function withDevSocketRsbuild<
  TMiddlewares extends unknown[],
  TConfig extends RsbuildConfig<TMiddlewares>,
>(
  config: TConfig,
  options: RsbuildDevSocketOptions = {},
): TConfig & RsbuildConfig<TMiddlewares> {
  return withDevSocketBuildTool<TMiddlewares, RsbuildDevServerLike, TConfig>(
    config,
    options,
  );
}
