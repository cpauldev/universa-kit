import { afterEach, describe, expect, it } from "bun:test";

import { BRIDGESOCKET_NEXT_BRIDGE_GLOBAL_KEY } from "../adapters/shared/adapter-utils.js";
import { createBridgeSocketToolPreset } from "../preset.js";

type StandaloneBridgeLike = {
  baseUrl: string;
  bridge: unknown;
  close?: () => Promise<void>;
};

const bridgeGlobal = globalThis as typeof globalThis & {
  [key: string]: unknown;
};
const createdKeys = new Set<string>();

function seedStandaloneBridge(key: string, baseUrl: string): void {
  bridgeGlobal[key] = Promise.resolve({
    baseUrl,
    bridge: {} as never,
    close: async () => undefined,
  } satisfies StandaloneBridgeLike);
  createdKeys.add(key);
}

async function clearSeededStandaloneBridges(): Promise<void> {
  const cleanupTasks: Promise<void>[] = [];

  for (const key of createdKeys) {
    const bridgePromise = bridgeGlobal[key] as
      | Promise<StandaloneBridgeLike>
      | undefined;
    if (bridgePromise) {
      cleanupTasks.push(
        (async () => {
          try {
            const bridge = await bridgePromise;
            await bridge.close?.();
          } catch {
            // Ignore cleanup failures for seeded bridge stubs.
          }
        })(),
      );
    }
    delete bridgeGlobal[key];
  }

  createdKeys.clear();
  await Promise.all(cleanupTasks);
}

afterEach(async () => {
  await clearSeededStandaloneBridges();
});

describe("createBridgeSocketToolPreset", () => {
  it("exposes all adapter surfaces from one preset object", () => {
    const preset = createBridgeSocketToolPreset();

    expect(typeof preset.vite).toBe("function");
    expect(typeof preset.next).toBe("function");
    expect(typeof preset.nuxt).toBe("function");
    expect(typeof preset.astro).toBe("function");

    expect(typeof preset.angularCli.startBridge).toBe("function");
    expect(typeof preset.angularCli.createProxyConfig).toBe("function");
    expect(typeof preset.angularCli.withProxyConfig).toBe("function");

    expect(typeof preset.bun.attach).toBe("function");
    expect(typeof preset.node.attach).toBe("function");
    expect(typeof preset.fastify.attach).toBe("function");
    expect(typeof preset.hono.attach).toBe("function");

    expect(typeof preset.webpack.withDevServer).toBe("function");
    expect(typeof preset.rsbuild.withDevServer).toBe("function");
    expect(typeof preset.rspack.withDevServer).toBe("function");
  });

  it("applies base options to next and angular-cli wrappers", async () => {
    const nextBridgeKey = `${BRIDGESOCKET_NEXT_BRIDGE_GLOBAL_KEY}:preset:next`;
    const angularBridgeKey = `${BRIDGESOCKET_NEXT_BRIDGE_GLOBAL_KEY}:preset:angular`;
    seedStandaloneBridge(nextBridgeKey, "http://127.0.0.1:40101");
    seedStandaloneBridge(angularBridgeKey, "http://127.0.0.1:40102");

    const preset = createBridgeSocketToolPreset({
      rewriteSource: "/acme/:path*",
      nextBridgeGlobalKey: nextBridgeKey,
      bridgePathPrefix: "/__acme",
    });

    const wrappedNextConfig = preset.next({
      rewrites: async () => [],
    });
    const rewrites = await wrappedNextConfig.rewrites?.();
    if (!rewrites || Array.isArray(rewrites)) {
      throw new Error("Expected Next rewrites object with beforeFiles");
    }

    expect(rewrites.beforeFiles[0]).toEqual({
      source: "/acme/:path*",
      destination: "http://127.0.0.1:40101/acme/:path*",
    });

    const proxyConfig = await preset.angularCli.createProxyConfig({
      angularCliBridgeGlobalKey: angularBridgeKey,
    });
    expect(proxyConfig).toEqual({
      "/__acme": {
        target: "http://127.0.0.1:40102",
        secure: false,
        changeOrigin: false,
        ws: true,
        logLevel: "warn",
      },
      "/__acme/**": {
        target: "http://127.0.0.1:40102",
        secure: false,
        changeOrigin: false,
        ws: true,
        logLevel: "warn",
      },
    });
  });

  it("allows per-call option overrides on top of preset defaults", async () => {
    const baseBridgeKey = `${BRIDGESOCKET_NEXT_BRIDGE_GLOBAL_KEY}:preset:base`;
    const overrideBridgeKey = `${BRIDGESOCKET_NEXT_BRIDGE_GLOBAL_KEY}:preset:override`;
    seedStandaloneBridge(baseBridgeKey, "http://127.0.0.1:40201");
    seedStandaloneBridge(overrideBridgeKey, "http://127.0.0.1:40202");

    const preset = createBridgeSocketToolPreset({
      rewriteSource: "/base/:path*",
      nextBridgeGlobalKey: baseBridgeKey,
    });

    const wrappedNextConfig = preset.next(
      {
        rewrites: async () => [],
      },
      {
        nextBridgeGlobalKey: overrideBridgeKey,
        rewriteSource: "/override/:path*",
      },
    );
    const rewrites = await wrappedNextConfig.rewrites?.();
    if (!rewrites || Array.isArray(rewrites)) {
      throw new Error("Expected Next rewrites object with beforeFiles");
    }

    expect(rewrites.beforeFiles[0]).toEqual({
      source: "/override/:path*",
      destination: "http://127.0.0.1:40202/override/:path*",
    });
  });
});
