import { isEventsUpgradePath } from "../../bridge/router.js";
import {
  type BridgeLifecycle,
  type MiddlewareAdapterServer,
  type UniversaAdapterOptions,
  appendPlugin,
  buildClientBootstrapModuleSource,
  createBridgeLifecycle,
  createClientBootstrapVirtualIds,
  resolveAdapterOptions,
} from "../shared/adapter-utils.js";

export type UniversaNuxtOptions = UniversaAdapterOptions;
export type UniversaNuxtModule = ((
  moduleOptions?: unknown,
  nuxt?: unknown,
) => void) & {
  meta: {
    name: string;
    configKey: string;
  };
};

export function createUniversaNuxtModule(
  options: UniversaNuxtOptions = {},
): UniversaNuxtModule {
  const resolvedOptions = resolveAdapterOptions(options);
  const clientModule =
    resolvedOptions.clientEnabled === false
      ? undefined
      : resolvedOptions.clientModule;
  const virtualIds = createClientBootstrapVirtualIds(
    resolvedOptions.namespaceId ?? resolvedOptions.adapterName,
  );
  const lifecycle = createBridgeLifecycle(resolvedOptions);
  let lastViteServer: MiddlewareAdapterServer | null = null;

  const bridgePlugin = {
    name: resolvedOptions.adapterName,
    enforce: "pre" as const,

    resolveId(id: string) {
      if (clientModule && id === virtualIds.virtualId) {
        return virtualIds.resolvedVirtualId;
      }
    },

    load(id: string) {
      if (clientModule && id === virtualIds.resolvedVirtualId) {
        return buildClientBootstrapModuleSource({
          clientModule,
          clientRuntimeContext: resolvedOptions.clientRuntimeContext,
          acceptHotUpdate: true,
        });
      }
    },

    transformIndexHtml: {
      order: "pre" as const,
      handler(_html: string, ctx: { server?: unknown }) {
        if (!clientModule || !ctx.server) return [];
        return [
          {
            tag: "script",
            attrs: { type: "module", src: virtualIds.publicSpecifier },
            injectTo: "head-prepend" as const,
          },
        ];
      },
    },

    async configureServer(server: MiddlewareAdapterServer) {
      lastViteServer = server;
      await lifecycle.setup(server);
    },
  };

  const meta = {
    name: resolvedOptions.adapterName,
    configKey: "universa",
  };

  function hasPluginWithName(
    plugins: unknown[] | undefined,
    name: string,
  ): boolean {
    if (!plugins?.length) return false;
    return plugins.some((plugin) => {
      if (!plugin || typeof plugin !== "object") return false;
      const candidate = plugin as { name?: unknown };
      return typeof candidate.name === "string" && candidate.name === name;
    });
  }

  function setup(_moduleOptions: unknown, nuxtInput: unknown) {
    const nuxt = (nuxtInput ?? {}) as {
      options?: unknown;
      hook?: unknown;
    };
    const nuxtOptions = (nuxt.options || {}) as {
      dev?: boolean;
      build?: { templates?: unknown[] };
      plugins?: unknown[];
    };
    if (!nuxtOptions.dev) return;

    // Nuxt does not reliably run transformIndexHtml on every navigation path.
    // Register a client plugin to ensure the client module is always imported.
    if (clientModule) {
      const templateFilename = `${resolvedOptions.adapterName}-client.client.mjs`;
      const templatePath = `#build/${templateFilename}`;
      const buildTemplates = (nuxtOptions.build ??= {}).templates ?? [];
      (nuxtOptions.build as { templates: unknown[] }).templates =
        buildTemplates;

      const hasTemplate = buildTemplates.some((entry) => {
        if (!entry || typeof entry !== "object") return false;
        const template = entry as { filename?: unknown };
        return template.filename === templateFilename;
      });

      if (!hasTemplate) {
        buildTemplates.push({
          filename: templateFilename,
          write: true,
          getContents: () =>
            buildClientBootstrapModuleSource({
              clientModule,
              clientRuntimeContext: resolvedOptions.clientRuntimeContext,
              footerLines: ["export default () => {};"],
            }),
        });
      }

      const plugins = nuxtOptions.plugins ?? [];
      nuxtOptions.plugins = plugins;
      const hasClientPlugin = plugins.some((entry) => {
        if (!entry || typeof entry !== "object") return false;
        const plugin = entry as { src?: unknown };
        return plugin.src === templatePath;
      });
      if (!hasClientPlugin) {
        plugins.push({ src: templatePath, mode: "client" });
      }
    }

    const hook = (nuxt.hook || (() => undefined)) as (
      name: string,
      callback: (...args: unknown[]) => void,
    ) => void;

    hook("vite:extendConfig", ((config: { plugins?: unknown[] }) => {
      if (hasPluginWithName(config.plugins, bridgePlugin.name)) return;
      config.plugins = appendPlugin(config.plugins, bridgePlugin);
    }) as (...args: unknown[]) => void);

    hook("listen", ((listenerServer: {
      on: (
        event: "upgrade" | "close",
        listener: (...args: unknown[]) => void,
      ) => void;
      listeners: (
        event: "upgrade" | "close",
      ) => ((...args: unknown[]) => void)[];
      removeAllListeners: (event: "upgrade" | "close") => void;
      __universaBridgeDispatcherInstalled?: boolean;
      __universaBridgeCloseHookInstalled?: boolean;
      __universaBridgeInitialUpgradeListeners?: ((
        ...args: unknown[]
      ) => void)[];
      __universaBridgeUpgradeSources?: Map<
        string,
        () => ReturnType<BridgeLifecycle["getBridge"]>
      >;
      __universaBridgeTeardowns?: Map<string, () => Promise<void>>;
    }) => {
      const bridgePathPrefix =
        resolvedOptions.bridgePathPrefix ?? "/__universa";
      const upgradeSources = (listenerServer.__universaBridgeUpgradeSources ??=
        new Map());
      const teardownHandlers = (listenerServer.__universaBridgeTeardowns ??=
        new Map());

      upgradeSources.set(bridgePathPrefix, () => lifecycle.getBridge());
      teardownHandlers.set(bridgePathPrefix, () => lifecycle.teardown());

      if (lastViteServer) {
        void lifecycle.setup(lastViteServer);
      }

      if (!listenerServer.__universaBridgeDispatcherInstalled) {
        listenerServer.__universaBridgeDispatcherInstalled = true;
        listenerServer.__universaBridgeInitialUpgradeListeners =
          listenerServer.listeners("upgrade");
        listenerServer.removeAllListeners("upgrade");

        listenerServer.on("upgrade", (...args: unknown[]) => {
          const [req, socket, head] = args as [
            import("http").IncomingMessage,
            import("stream").Duplex,
            Buffer,
          ];
          const requestPath = req.url || "/";

          const sources = listenerServer.__universaBridgeUpgradeSources;
          if (sources) {
            for (const [prefix, getBridge] of sources.entries()) {
              if (!isEventsUpgradePath(requestPath, prefix)) continue;
              const bridge = getBridge();
              if (!bridge) {
                socket.destroy();
                return;
              }
              bridge.handleUpgrade(req, socket, head);
              return;
            }
          }

          for (const listener of listenerServer.__universaBridgeInitialUpgradeListeners ??
            []) {
            listener(req, socket, head);
          }
        });
      }

      if (!listenerServer.__universaBridgeCloseHookInstalled) {
        listenerServer.__universaBridgeCloseHookInstalled = true;
        listenerServer.on("close", () => {
          const teardowns = [
            ...(listenerServer.__universaBridgeTeardowns?.values() ?? []),
          ];
          void Promise.all(teardowns.map((teardown) => teardown()));
        });
      }
    }) as (...args: unknown[]) => void);
  }

  return Object.assign(setup, { meta }) as UniversaNuxtModule;
}
