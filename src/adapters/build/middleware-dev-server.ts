import type { IncomingMessage, ServerResponse } from "http";

import {
  createBridgeLifecycle,
  resolveAdapterOptions,
  type BridgeLifecycle,
  type BridgeSocketAdapterOptions,
  type MiddlewareAdapterServer,
} from "../shared/adapter-utils.js";

export interface SetupMiddlewaresApp {
  use: (
    fn: (
      req: IncomingMessage,
      res: ServerResponse,
      next: (error?: unknown) => void,
    ) => void,
  ) => void;
}

export interface SetupMiddlewaresHttpServer {
  on: (
    event: "upgrade" | "close",
    listener: (...args: unknown[]) => void,
  ) => void;
}

export interface SetupMiddlewaresDevServerLike {
  app?: SetupMiddlewaresApp;
  server?: SetupMiddlewaresHttpServer;
}

export interface SetupMiddlewaresConfig<
  TMiddlewares extends unknown[] = unknown[],
  TDevServer extends SetupMiddlewaresDevServerLike = SetupMiddlewaresDevServerLike,
> {
  setupMiddlewares?: (
    middlewares: TMiddlewares,
    devServer: TDevServer,
  ) => TMiddlewares;
}

function toMiddlewareAdapterServer(
  devServer: SetupMiddlewaresDevServerLike,
): MiddlewareAdapterServer | null {
  const app = devServer.app;
  if (!app || typeof app.use !== "function") {
    return null;
  }

  return {
    middlewares: {
      use: (handler) => {
        app.use(handler);
      },
    },
    httpServer: devServer.server ?? null,
  };
}

export function createSetupMiddlewaresBridgeLifecycle(
  options: BridgeSocketAdapterOptions = {},
): BridgeLifecycle {
  return createBridgeLifecycle(resolveAdapterOptions(options));
}

export function withBridgeSocketSetupMiddlewares<
  TMiddlewares extends unknown[],
  TDevServer extends SetupMiddlewaresDevServerLike,
  TConfig extends SetupMiddlewaresConfig<TMiddlewares, TDevServer>,
>(
  config: TConfig,
  options: BridgeSocketAdapterOptions = {},
): TConfig & SetupMiddlewaresConfig<TMiddlewares, TDevServer> {
  const lifecycle = createSetupMiddlewaresBridgeLifecycle(options);
  const originalSetupMiddlewares = config.setupMiddlewares;

  return {
    ...config,
    setupMiddlewares: (middlewares, devServer) => {
      const adapterServer = toMiddlewareAdapterServer(devServer);
      if (adapterServer) {
        void lifecycle.setup(adapterServer);
      }

      if (originalSetupMiddlewares) {
        return originalSetupMiddlewares(middlewares, devServer);
      }
      return middlewares;
    },
  } as TConfig & SetupMiddlewaresConfig<TMiddlewares, TDevServer>;
}

