import {
  type BridgeSocketAdapterOptions,
  appendPlugin,
  resolveAdapterOptions,
} from "../shared/adapter-utils.js";
import { createBridgeSocketVitePlugin } from "../shared/plugin.js";

export type BridgeSocketNuxtOptions = BridgeSocketAdapterOptions;

export function createBridgeSocketNuxtModule(
  options: BridgeSocketNuxtOptions = {},
) {
  const resolvedOptions = resolveAdapterOptions(options);

  return {
    meta: {
      name: resolvedOptions.adapterName,
      configKey: "bridgeSocket",
    },
    setup: (_moduleOptions: unknown, nuxt: Record<string, unknown>) => {
      const nuxtOptions = (nuxt.options || {}) as { dev?: boolean };
      if (!nuxtOptions.dev) return;

      const hook = (nuxt.hook || (() => undefined)) as (
        name: string,
        callback: (...args: unknown[]) => void,
      ) => void;

      hook("vite:extendConfig", ((config: { plugins?: unknown[] }) => {
        config.plugins = appendPlugin(
          config.plugins,
          createBridgeSocketVitePlugin(resolvedOptions),
        );
      }) as (...args: unknown[]) => void);
    },
  };
}
