import { createUnplugin } from "unplugin";

import {
  type BridgeSocketAdapterOptions,
  type ViteAdapterServer,
  createBridgeLifecycle,
  resolveAdapterOptions,
} from "./adapter-utils.js";

export type BridgeSocketVitePluginOptions = BridgeSocketAdapterOptions;

const unplugin = createUnplugin<BridgeSocketVitePluginOptions | undefined>(
  (options = {}) => {
    const resolvedOptions = resolveAdapterOptions(options);
    const lifecycle = createBridgeLifecycle(resolvedOptions);

    return {
      name: resolvedOptions.adapterName,
      enforce: "pre",
      vite: {
        async configureServer(server: ViteAdapterServer) {
          await lifecycle.setup(server);
        },
      },
    };
  },
);

export const createBridgeSocketVitePlugin = unplugin.vite;

export { unplugin as createBridgeSocketUnplugin };
