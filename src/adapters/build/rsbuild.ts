import type { BridgeLifecycle, BridgeSocketAdapterOptions } from "../shared/adapter-utils.js";
import {
  createBuildToolBridgeLifecycle,
  withBridgeSocketBuildTool,
  type BuildToolConfig,
  type BuildToolDevServerLike,
} from "./create-build-adapter.js";

export type RsbuildDevServerLike = BuildToolDevServerLike;
export type RsbuildConfig<TMiddlewares extends unknown[] = unknown[]> =
  BuildToolConfig<TMiddlewares>;

export type RsbuildBridgeSocketOptions = BridgeSocketAdapterOptions;

export function createRsbuildBridgeLifecycle(
  options: RsbuildBridgeSocketOptions = {},
): BridgeLifecycle {
  return createBuildToolBridgeLifecycle(options);
}

export function withBridgeSocketRsbuild<
  TMiddlewares extends unknown[],
  TConfig extends RsbuildConfig<TMiddlewares>,
>(
  config: TConfig,
  options: RsbuildBridgeSocketOptions = {},
): TConfig & RsbuildConfig<TMiddlewares> {
  return withBridgeSocketBuildTool<TMiddlewares, RsbuildDevServerLike, TConfig>(
    config,
    options,
  );
}

