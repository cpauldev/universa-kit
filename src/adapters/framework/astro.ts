import {
  type ResolvedUniversalClientEntry,
  createUniversalClientEntryVitePlugin,
} from "../client-entry.js";
import {
  type MiddlewareAdapterServer,
  type UniversalAdapterOptions,
  createBridgeLifecycle,
  resolveAdapterOptions,
} from "../shared/adapter-utils.js";

export type AstroUniversalOptions = UniversalAdapterOptions;
export type UniversalAstroIntegration = {
  name: string;
  hooks: Record<string, (options: unknown) => void | Promise<void>>;
};

export function createUniversalAstroIntegration(
  options: AstroUniversalOptions = {},
  clientEntries: readonly ResolvedUniversalClientEntry[] = [],
): UniversalAstroIntegration {
  const resolvedOptions = resolveAdapterOptions(options);
  const lifecycle = createBridgeLifecycle(resolvedOptions);
  const clientEntryPlugin = createUniversalClientEntryVitePlugin(clientEntries);

  return {
    name: resolvedOptions.adapterName,
    hooks: {
      "astro:config:setup": (input: unknown) => {
        if (!clientEntryPlugin) return;
        const updateConfig = (
          input as {
            updateConfig?: (config: {
              vite: { plugins: [typeof clientEntryPlugin] };
            }) => void;
          }
        ).updateConfig;
        updateConfig?.({ vite: { plugins: [clientEntryPlugin] } });
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
