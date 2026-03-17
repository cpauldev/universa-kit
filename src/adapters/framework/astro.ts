import {
  type MiddlewareAdapterServer,
  type UniversaAdapterOptions,
  createBridgeLifecycle,
  resolveAdapterOptions,
} from "../shared/adapter-utils.js";

export type AstroUniversaOptions = UniversaAdapterOptions;
export type UniversaAstroIntegration = {
  name: string;
  hooks: Record<string, (options: unknown) => void | Promise<void>>;
};

export function createUniversaAstroIntegration(
  options: AstroUniversaOptions = {},
): UniversaAstroIntegration {
  const resolvedOptions = resolveAdapterOptions(options);
  const lifecycle = createBridgeLifecycle(resolvedOptions);

  return {
    name: resolvedOptions.adapterName,
    hooks: {
      "astro:server:setup": async (options: unknown) => {
        const server = (options as { server?: MiddlewareAdapterServer })
          ?.server;
        if (!server) return;
        await lifecycle.setup(server);
      },
      "astro:server:done": async () => {
        await lifecycle.teardown();
      },
    },
  };
}
