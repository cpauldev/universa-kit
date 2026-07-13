import {
  type ResolvedUniversalClientEntry,
  createUniversalClientEntryBootstrap,
} from "../client-entry.js";
import type { StandaloneBridgeServer } from "../../bridge/standalone.js";
import { fileURLToPath } from "node:url";
import {
  UNIVERSAL_NEXT_BRIDGE_GLOBAL_KEY,
  type UniversalAdapterOptions,
  type UniversalRewriteSpec,
  createBridgeRewriteRoute,
  createDirectRewriteRoute,
  ensureStandaloneBridgeSingleton,
  normalizeRewrites,
  resolveAdapterOptions,
} from "../shared/adapter-utils.js";

type MaybePromise<T> = T | Promise<T>;

export type UniversalNextOptions = UniversalAdapterOptions;

const NEXT_BRIDGE_GLOBAL_KEY_PREFIX = `${UNIVERSAL_NEXT_BRIDGE_GLOBAL_KEY}:next`;
const NEXT_CLIENT_ENTRY_RULE = "*";
let nextBridgeInstanceCounter = 0;

function createDefaultNextBridgeGlobalKey(): string {
  nextBridgeInstanceCounter += 1;
  return `${NEXT_BRIDGE_GLOBAL_KEY_PREFIX}:${process.pid}:${nextBridgeInstanceCounter}`;
}

function ensureBridge(
  options: UniversalNextOptions,
): Promise<StandaloneBridgeServer> {
  return ensureStandaloneBridgeSingleton(options);
}

export function withUniversalNext<T extends object>(
  nextConfig: T,
  options: UniversalNextOptions = {},
  clientEntries: readonly ResolvedUniversalClientEntry[] = [],
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
    rewrites?: () => MaybePromise<UniversalRewriteSpec>;
    turbopack?: { rules?: Record<string, unknown> };
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
    const additionalRoutes = (bridgeOptions.additionalRewriteSources ?? []).map(
      (source) => createDirectRewriteRoute(bridge.baseUrl, source),
    );
    const existing = originalRewrites ? await originalRewrites() : undefined;
    const normalized = normalizeRewrites(existing);

    return {
      beforeFiles: [route, ...additionalRoutes, ...normalized.beforeFiles],
      afterFiles: normalized.afterFiles,
      fallback: normalized.fallback,
    };
  };

  const clientBootstrap = createUniversalClientEntryBootstrap(clientEntries);
  if (clientBootstrap) {
    const existingRules = next.turbopack?.rules ?? {};
    const clientEntryRule = {
      condition: {
        all: [
          "browser",
          "development",
          { not: "foreign" },
          { path: "*.{js,jsx,ts,tsx}" },
        ],
      },
      loaders: [
        {
          loader: fileURLToPath(
            new URL("../client-entry/next-loader.cjs", import.meta.url),
          ),
          options: { bootstrap: clientBootstrap },
        },
      ],
      as: "*.js",
    };
    const existingClientEntryRule = existingRules[NEXT_CLIENT_ENTRY_RULE];
    next.turbopack = {
      ...next.turbopack,
      rules: {
        ...existingRules,
        // Turbopack runs all matching rules in order. A catch-all rule with a
        // path condition avoids replacing a consumer's extension-specific rule.
        [NEXT_CLIENT_ENTRY_RULE]: existingClientEntryRule
          ? Array.isArray(existingClientEntryRule)
            ? [...existingClientEntryRule, clientEntryRule]
            : [existingClientEntryRule, clientEntryRule]
          : clientEntryRule,
      },
    };
  }

  return next;
}
