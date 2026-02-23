import {
  type RsbuildBridgeSocketOptions,
  type RsbuildConfig,
  withBridgeSocketRsbuild,
} from "./adapters/build/rsbuild.js";
import {
  type RspackBridgeSocketOptions,
  type RspackConfig,
  withBridgeSocketRspack,
} from "./adapters/build/rspack.js";
import {
  type WebpackBridgeSocketOptions,
  type WebpackDevServerConfig,
  withBridgeSocketWebpackDevServer,
} from "./adapters/build/webpack.js";
import {
  type AngularCliBridgeSocketOptions,
  type AngularCliBridgeSocketProxyConfig,
  createBridgeSocketAngularCliProxyConfig,
  startBridgeSocketAngularCliBridge,
  withBridgeSocketAngularCliProxyConfig,
} from "./adapters/framework/angular-cli.js";
import {
  type AstroBridgeSocketOptions,
  createBridgeSocketAstroIntegration,
} from "./adapters/framework/astro.js";
import {
  type BridgeSocketNextOptions,
  withBridgeSocketNext,
} from "./adapters/framework/next.js";
import {
  type BridgeSocketNuxtOptions,
  createBridgeSocketNuxtModule,
} from "./adapters/framework/nuxt.js";
import {
  type BunBridgeHandle,
  type BunBridgeSocketOptions,
  attachBridgeSocketToBunServe,
} from "./adapters/server/bun.js";
import {
  type FastifyBridgeHandle,
  type FastifyBridgeSocketOptions,
  type FastifyLikeInstance,
  attachBridgeSocketToFastify,
} from "./adapters/server/fastify.js";
import {
  type HonoBridgeHandle,
  type HonoBridgeSocketOptions,
  type HonoNodeServer,
  attachBridgeSocketToHonoNodeServer,
} from "./adapters/server/hono.js";
import {
  type NodeBridgeHandle,
  type NodeBridgeSocketOptions,
  attachBridgeSocketToNodeServer,
} from "./adapters/server/node.js";
import {
  type BridgeSocketVitePluginOptions,
  createBridgeSocketVitePlugin,
} from "./adapters/shared/plugin.js";

export type BridgeSocketToolPresetOptions = BridgeSocketVitePluginOptions;

export interface BridgeSocketToolPreset {
  vite: (
    options?: BridgeSocketVitePluginOptions,
  ) => ReturnType<typeof createBridgeSocketVitePlugin>;
  next: <T extends object>(
    nextConfig: T,
    options?: BridgeSocketNextOptions,
  ) => T;
  nuxt: (
    options?: BridgeSocketNuxtOptions,
  ) => ReturnType<typeof createBridgeSocketNuxtModule>;
  astro: (
    options?: AstroBridgeSocketOptions,
  ) => ReturnType<typeof createBridgeSocketAstroIntegration>;
  angularCli: {
    startBridge: (
      options?: AngularCliBridgeSocketOptions,
    ) => ReturnType<typeof startBridgeSocketAngularCliBridge>;
    createProxyConfig: (
      options?: AngularCliBridgeSocketOptions,
    ) => ReturnType<typeof createBridgeSocketAngularCliProxyConfig>;
    withProxyConfig: (
      existingProxyConfig?: AngularCliBridgeSocketProxyConfig,
      options?: AngularCliBridgeSocketOptions,
    ) => ReturnType<typeof withBridgeSocketAngularCliProxyConfig>;
  };
  bun: {
    attach: (options?: BunBridgeSocketOptions) => Promise<BunBridgeHandle>;
  };
  node: {
    attach: (
      server: Parameters<typeof attachBridgeSocketToNodeServer>[0],
      options?: NodeBridgeSocketOptions,
    ) => Promise<NodeBridgeHandle>;
  };
  fastify: {
    attach: (
      fastify: FastifyLikeInstance,
      options?: FastifyBridgeSocketOptions,
    ) => Promise<FastifyBridgeHandle>;
  };
  hono: {
    attach: (
      server: HonoNodeServer,
      options?: HonoBridgeSocketOptions,
    ) => Promise<HonoBridgeHandle>;
  };
  webpack: {
    withDevServer: <
      TMiddlewares extends unknown[],
      TConfig extends WebpackDevServerConfig<TMiddlewares>,
    >(
      config: TConfig,
      options?: WebpackBridgeSocketOptions,
    ) => TConfig & WebpackDevServerConfig<TMiddlewares>;
  };
  rsbuild: {
    withDevServer: <
      TMiddlewares extends unknown[],
      TConfig extends RsbuildConfig<TMiddlewares>,
    >(
      config: TConfig,
      options?: RsbuildBridgeSocketOptions,
    ) => TConfig & RsbuildConfig<TMiddlewares>;
  };
  rspack: {
    withDevServer: <
      TMiddlewares extends unknown[],
      TConfig extends RspackConfig<TMiddlewares>,
    >(
      config: TConfig,
      options?: RspackBridgeSocketOptions,
    ) => TConfig & RspackConfig<TMiddlewares>;
  };
}

function mergeOptions<T extends object>(
  baseOptions: BridgeSocketToolPresetOptions,
  options?: T,
): BridgeSocketToolPresetOptions & T {
  return { ...baseOptions, ...(options ?? ({} as T)) };
}

export function createBridgeSocketToolPreset(
  baseOptions: BridgeSocketToolPresetOptions = {},
): BridgeSocketToolPreset {
  return {
    vite: (options = {}) =>
      createBridgeSocketVitePlugin(mergeOptions(baseOptions, options)),
    next<T extends object>(
      nextConfig: T,
      options: BridgeSocketNextOptions = {},
    ): T {
      return withBridgeSocketNext(
        nextConfig,
        mergeOptions(baseOptions, options),
      );
    },
    nuxt: (options = {}) =>
      createBridgeSocketNuxtModule(mergeOptions(baseOptions, options)),
    astro: (options = {}) =>
      createBridgeSocketAstroIntegration(mergeOptions(baseOptions, options)),
    angularCli: {
      startBridge: (options = {}) =>
        startBridgeSocketAngularCliBridge(mergeOptions(baseOptions, options)),
      createProxyConfig: (options = {}) =>
        createBridgeSocketAngularCliProxyConfig(
          mergeOptions(baseOptions, options),
        ),
      withProxyConfig: (existingProxyConfig = {}, options = {}) =>
        withBridgeSocketAngularCliProxyConfig(
          existingProxyConfig,
          mergeOptions(baseOptions, options),
        ),
    },
    bun: {
      attach: (options = {}) =>
        attachBridgeSocketToBunServe(mergeOptions(baseOptions, options)),
    },
    node: {
      attach: (server, options = {}) =>
        attachBridgeSocketToNodeServer(
          server,
          mergeOptions(baseOptions, options),
        ),
    },
    fastify: {
      attach: (fastify, options = {}) =>
        attachBridgeSocketToFastify(
          fastify,
          mergeOptions(baseOptions, options),
        ),
    },
    hono: {
      attach: (server, options = {}) =>
        attachBridgeSocketToHonoNodeServer(
          server,
          mergeOptions(baseOptions, options),
        ),
    },
    webpack: {
      withDevServer: (config, options = {}) =>
        withBridgeSocketWebpackDevServer(
          config,
          mergeOptions(baseOptions, options),
        ),
    },
    rsbuild: {
      withDevServer: (config, options = {}) =>
        withBridgeSocketRsbuild(config, mergeOptions(baseOptions, options)),
    },
    rspack: {
      withDevServer: (config, options = {}) =>
        withBridgeSocketRspack(config, mergeOptions(baseOptions, options)),
    },
  };
}
