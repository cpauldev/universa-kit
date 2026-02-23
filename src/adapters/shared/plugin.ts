import {
  type BridgeSocketAdapterOptions,
  type ViteAdapterServer,
  createBridgeLifecycle,
  resolveAdapterOptions,
} from "./adapter-utils.js";

export type BridgeSocketVitePluginOptions = BridgeSocketAdapterOptions;
export function createBridgeSocketVitePlugin(
  options: BridgeSocketVitePluginOptions = {},
) {
  const resolvedOptions = resolveAdapterOptions(options);
  const lifecycle = createBridgeLifecycle(resolvedOptions);

  return {
    name: resolvedOptions.adapterName,
    enforce: "pre" as const,
    async configureServer(server: ViteAdapterServer) {
      await lifecycle.setup(server);
    },
  };
}
