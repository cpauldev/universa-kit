import {
  type DevSocketAdapterOptions,
  type MiddlewareAdapterServer,
  createBridgeLifecycle,
  resolveAdapterOptions,
} from "../shared/adapter-utils.js";

export type AstroDevSocketOptions = DevSocketAdapterOptions;

export function createDevSocketAstroIntegration(
  options: AstroDevSocketOptions = {},
) {
  const resolvedOptions = resolveAdapterOptions(options);
  const lifecycle = createBridgeLifecycle(resolvedOptions);

  return {
    name: resolvedOptions.adapterName,
    hooks: {
      "astro:server:setup": async ({
        server,
      }: {
        server: MiddlewareAdapterServer;
      }) => {
        await lifecycle.setup(server);
      },
      "astro:server:done": async () => {
        await lifecycle.teardown();
      },
    },
  };
}
