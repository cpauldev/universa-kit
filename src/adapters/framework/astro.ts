import {
  type MiddlewareAdapterServer,
  type UniversaAdapterOptions,
  buildClientBootstrapModuleSource,
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
  const clientModule =
    resolvedOptions.clientEnabled === false
      ? undefined
      : resolvedOptions.clientModule;

  return {
    name: resolvedOptions.adapterName,
    hooks: {
      "astro:config:setup": (options: unknown) => {
        const setupOptions = (options ?? {}) as {
          command?: string;
          injectScript?: (stage: unknown, content: string) => void;
        };
        const command = setupOptions.command;
        const injectScript = setupOptions.injectScript;
        if (clientModule && command === "dev" && injectScript) {
          injectScript(
            "page",
            buildClientBootstrapModuleSource({
              clientModule,
              clientRuntimeContext: resolvedOptions.clientRuntimeContext,
            }),
          );
        }
      },
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
