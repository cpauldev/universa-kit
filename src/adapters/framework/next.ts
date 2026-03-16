import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

import type { StandaloneBridgeServer } from "../../bridge/standalone.js";
import {
  UNIVERSA_NEXT_BRIDGE_GLOBAL_KEY,
  type UniversaAdapterOptions,
  type UniversaRewriteSpec,
  createBridgeRewriteRoute,
  ensureStandaloneBridgeSingleton,
  normalizeRewrites,
  resolveAdapterOptions,
} from "../shared/adapter-utils.js";

type MaybePromise<T> = T | Promise<T>;
const NEXT_PUBLIC_CLIENT_CONTEXTS_ENV_KEY =
  "NEXT_PUBLIC_UNIVERSA_CLIENT_CONTEXTS";

export type UniversaNextOptions = UniversaAdapterOptions;

const NEXT_BRIDGE_GLOBAL_KEY_PREFIX = `${UNIVERSA_NEXT_BRIDGE_GLOBAL_KEY}:next`;
let nextBridgeInstanceCounter = 0;

function createDefaultNextBridgeGlobalKey(): string {
  nextBridgeInstanceCounter += 1;
  return `${NEXT_BRIDGE_GLOBAL_KEY_PREFIX}:${process.pid}:${nextBridgeInstanceCounter}`;
}

function ensureBridge(
  options: UniversaNextOptions,
): Promise<StandaloneBridgeServer> {
  return ensureStandaloneBridgeSingleton(options);
}

type WebpackEntryDescriptor = { import?: string[] };
type WebpackEntryValue = string[] | WebpackEntryDescriptor;
type WebpackEntries = Record<string, WebpackEntryValue>;
type WebpackConfig = Record<string, unknown> & { entry?: unknown };
type WebpackCtx = { isServer: boolean; dev: boolean };

function parseClientContextMap(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function prependClientToEntries(
  entries: WebpackEntries,
  clientModule: string,
): WebpackEntries {
  for (const key of Object.keys(entries)) {
    const entry = entries[key];
    if (Array.isArray(entry)) {
      if (!entry.includes(clientModule)) {
        entries[key] = [clientModule, ...entry];
      }
    } else if (
      entry &&
      typeof entry === "object" &&
      Array.isArray(entry.import)
    ) {
      if (!entry.import.includes(clientModule)) {
        entry.import = [clientModule, ...entry.import];
      }
    }
  }
  return entries;
}

// Resolved at module load time — points to the CJS loader shipped with this package.
const CLIENT_INJECT_LOADER_PATH = fileURLToPath(
  new URL("./client-inject.cjs", import.meta.url),
);

// Next.js 15.1+ automatically includes instrumentation-client.ts as a separate
// Turbopack entry point (NOT in the bootstrap chain), so its chunking context
// allows external module references. It's also within process.cwd(), which
// means standard node_modules lookup finds workspace packages correctly.
const NEXT_TURBOPACK_CLIENT_ENTRY = "**/instrumentation-client.{ts,js,tsx,jsx}";

// Ensures instrumentation-client.ts exists so Next.js/Turbopack picks it up.
// Creates an empty file if missing; never overwrites existing content.
function ensureInstrumentationClientFile(): void {
  const candidates = [
    join(process.cwd(), "src", "instrumentation-client.ts"),
    join(process.cwd(), "instrumentation-client.ts"),
  ];
  const existing = candidates.find((p) => existsSync(p));
  if (!existing) {
    const [target] = candidates;
    try {
      writeFileSync(target, "");
    } catch {
      // best-effort; if creation fails, injection just won't fire
    }
  }
}

export function withUniversaNext<T extends object>(
  nextConfig: T,
  options: UniversaNextOptions = {},
): T {
  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev) {
    return nextConfig;
  }

  const resolvedOptions = resolveAdapterOptions(options);
  const isFrameworkActive = resolvedOptions._frameworkIsActive;
  const nextBridgeGlobalKey =
    options.nextBridgeGlobalKey ?? createDefaultNextBridgeGlobalKey();
  const bridgeOptions = { ...resolvedOptions, nextBridgeGlobalKey };
  const next = { ...nextConfig } as T & {
    rewrites?: () => MaybePromise<UniversaRewriteSpec>;
    webpack?: (config: WebpackConfig, ctx: WebpackCtx) => WebpackConfig;
  };
  const originalRewrites = next.rewrites;

  next.rewrites = async () => {
    if (isFrameworkActive && !isFrameworkActive()) {
      return originalRewrites ? await originalRewrites() : [];
    }

    const bridge = await ensureBridge(bridgeOptions);
    const route = createBridgeRewriteRoute(
      bridge.baseUrl,
      bridgeOptions.rewriteSource,
    );
    const existing = originalRewrites ? await originalRewrites() : undefined;
    const normalized = normalizeRewrites(existing);

    return {
      beforeFiles: [route, ...normalized.beforeFiles],
      afterFiles: normalized.afterFiles,
      fallback: normalized.fallback,
    };
  };

  const clientModule = resolvedOptions.clientModule;
  const clientContext = resolvedOptions.clientRuntimeContext;
  if (clientModule && resolvedOptions.clientEnabled !== false) {
    if (clientContext) {
      const nextAny = next as Record<string, unknown>;
      const envValue =
        typeof nextAny.env === "object" && nextAny.env
          ? (nextAny.env as Record<string, unknown>)
          : {};
      const clientContexts = parseClientContextMap(
        envValue[NEXT_PUBLIC_CLIENT_CONTEXTS_ENV_KEY],
      );
      clientContexts[clientModule] = clientContext;
      nextAny.env = {
        ...envValue,
        [NEXT_PUBLIC_CLIENT_CONTEXTS_ENV_KEY]: JSON.stringify(clientContexts),
      };
    }

    // Webpack (used when Turbopack is explicitly disabled): prepend the client
    // module to every client entry so it loads before the app code.
    const originalWebpack = next.webpack;
    next.webpack = (config: WebpackConfig, ctx: WebpackCtx): WebpackConfig => {
      const baseConfig = originalWebpack
        ? originalWebpack(config, ctx)
        : config;
      if (isFrameworkActive && !isFrameworkActive()) return baseConfig;
      if (ctx.isServer || !ctx.dev) return baseConfig;

      const originalEntry = baseConfig.entry as
        | ((...args: unknown[]) => Promise<WebpackEntries>)
        | WebpackEntries
        | undefined;

      baseConfig.entry = async (
        ...args: unknown[]
      ): Promise<WebpackEntries> => {
        const entries: WebpackEntries =
          typeof originalEntry === "function"
            ? await originalEntry(...args)
            : (originalEntry ?? {});
        return prependClientToEntries(entries, clientModule);
      };

      return baseConfig;
    };

    const nextAny = next as Record<string, unknown>;

    // Ensure the client module's package is in transpilePackages so Turbopack
    // includes it in the project's module graph. Without this, workspace
    // packages (symlinked from packages/) are treated as external by Turbopack
    // and can't be imported from inside node_modules (e.g. app-next-turbopack).
    const clientPackageName = clientModule.split("/")[0] as string;
    const existingTranspile = (nextAny.transpilePackages as string[]) ?? [];
    if (!existingTranspile.includes(clientPackageName)) {
      nextAny.transpilePackages = [...existingTranspile, clientPackageName];
    }

    // Next.js 16+ errors when a webpack config exists alongside Turbopack
    // (now the default) but no turbopack config is set. Ensure an empty
    // turbopack key is present so Next.js knows this is intentional.
    if (!nextAny.turbopack) {
      nextAny.turbopack = {};
    }

    // Turbopack does not call the webpack entry function. Instead, inject the
    // clientModule import into instrumentation-client.ts — a Next.js 15.1+
    // file that is compiled as a SEPARATE entry (not in the bootstrap chain),
    // so its chunking context allows external module references. The file is
    // within process.cwd(), so standard node_modules lookup finds workspace
    // packages, and transpilePackages causes inline (non-external) compilation.
    ensureInstrumentationClientFile();

    const turbopackConfig = nextAny.turbopack as Record<string, unknown>;
    const existingRules =
      (turbopackConfig.rules as Record<string, unknown>) ?? {};
    turbopackConfig.rules = {
      ...existingRules,
      [NEXT_TURBOPACK_CLIENT_ENTRY]: {
        loaders: [
          {
            loader: CLIENT_INJECT_LOADER_PATH,
            options: { module: clientModule },
          },
        ],
      },
    };
  }

  return next;
}
