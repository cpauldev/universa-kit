import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";

import {
  type UniversaAdapterOptions,
  type ViteAdapterServer,
  buildClientBootstrapModuleSource,
  createBridgeLifecycle,
  createClientBootstrapVirtualIds,
  resolveAdapterOptions,
} from "./adapter-utils.js";

function readPackageDependencyNames(projectRoot: string): Set<string> {
  const packageJsonPath = join(projectRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return new Set();
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
      peerDependencies?: Record<string, unknown>;
    };

    return new Set([
      ...Object.keys(parsed.dependencies ?? {}),
      ...Object.keys(parsed.devDependencies ?? {}),
      ...Object.keys(parsed.peerDependencies ?? {}),
    ]);
  } catch {
    return new Set();
  }
}

function normalizeModuleId(id: string): string {
  return id.split("?")[0]?.replace(/\\/g, "/") ?? "";
}

function isVinextBrowserEntryModule(id: string): boolean {
  const normalizedId = normalizeModuleId(id);
  return (
    normalizedId.includes("virtual:vinext-client-entry") ||
    normalizedId.includes("virtual:vinext-app-browser-entry")
  );
}

function isSvelteKitClientAppModule(id: string): boolean {
  const normalizedId = normalizeModuleId(id);
  return normalizedId.endsWith("/.svelte-kit/generated/client/app.js");
}

type VitePluginConfig = {
  root?: string;
};

export type UniversaVitePluginOptions = UniversaAdapterOptions;
export function createUniversaVitePlugin(
  options: UniversaVitePluginOptions = {},
) {
  const resolvedOptions = resolveAdapterOptions(options);
  const lifecycle = createBridgeLifecycle(resolvedOptions);
  const clientModule =
    resolvedOptions.clientEnabled === false
      ? undefined
      : resolvedOptions.clientModule;
  const virtualIds = createClientBootstrapVirtualIds(
    resolvedOptions.namespaceId ?? resolvedOptions.adapterName,
  );
  let shouldInjectHtmlBootstrap = false;
  let shouldWrapSvelteKitEntry = false;
  let shouldWrapVinextEntries = false;

  function resolveProjectBehavior(projectRoot: string): void {
    if (!clientModule) return;

    const dependencyNames = readPackageDependencyNames(projectRoot);
    shouldWrapSvelteKitEntry = dependencyNames.has("@sveltejs/kit");
    shouldWrapVinextEntries = dependencyNames.has("vinext");
    shouldInjectHtmlBootstrap =
      !shouldWrapSvelteKitEntry && !shouldWrapVinextEntries;
  }

  resolveProjectBehavior(process.cwd());

  return {
    name: resolvedOptions.adapterName,
    enforce: "pre" as const,
    apply: "serve" as const,

    config(config: VitePluginConfig) {
      resolveProjectBehavior(resolve(config.root ?? process.cwd()));
    },

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

    transform(code: string, id: string) {
      if (!clientModule) {
        return undefined;
      }

      if (shouldWrapVinextEntries && isVinextBrowserEntryModule(id)) {
        if (code.includes(virtualIds.virtualId)) {
          return code;
        }
        return `import ${JSON.stringify(virtualIds.virtualId)};\n${code}`;
      }

      if (shouldWrapSvelteKitEntry && isSvelteKitClientAppModule(id)) {
        if (code.includes(virtualIds.virtualId)) {
          return code;
        }
        return `import ${JSON.stringify(virtualIds.virtualId)};\n${code}`;
      }

      return undefined;
    },

    transformIndexHtml: {
      order: "pre" as const,
      handler(_html: string, ctx: { server?: unknown }) {
        if (!clientModule || !ctx.server || !shouldInjectHtmlBootstrap) {
          return [];
        }

        return [
          {
            tag: "script",
            attrs: { type: "module", src: virtualIds.publicSpecifier },
            injectTo: "head-prepend" as const,
          },
        ];
      },
    },

    async configureServer(server: ViteAdapterServer) {
      await lifecycle.setup(server);
    },
  };
}
