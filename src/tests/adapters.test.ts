import { afterEach, describe, expect, it } from "bun:test";

import {
  createBridgeSocketAngularCliProxyConfig,
  withBridgeSocketAngularCliProxyConfig,
} from "../adapters/framework/angular-cli.js";
import { createBridgeSocketAstroIntegration } from "../adapters/framework/astro.js";
import { withBridgeSocketNext } from "../adapters/framework/next.js";
import { createBridgeSocketNuxtModule } from "../adapters/framework/nuxt.js";
import { BRIDGESOCKET_NEXT_BRIDGE_GLOBAL_KEY } from "../adapters/shared/adapter-utils.js";
import { createBridgeSocketVitePlugin } from "../adapters/shared/plugin.js";
import { createMiddlewareAdapterServerFixture } from "./utils/adapter-server-fixtures.js";

const originalNodeEnv = process.env.NODE_ENV;

async function clearBridgeGlobals(): Promise<void> {
  const bridgeGlobal = globalThis as typeof globalThis & {
    [key: string]: unknown;
  };
  const cleanupTasks: Promise<void>[] = [];

  for (const key of Object.keys(bridgeGlobal)) {
    if (key.startsWith(BRIDGESOCKET_NEXT_BRIDGE_GLOBAL_KEY)) {
      const bridgePromise = bridgeGlobal[key] as
        | Promise<{ close?: () => Promise<void> }>
        | undefined;
      if (bridgePromise) {
        cleanupTasks.push(
          (async () => {
            try {
              const standalone = await bridgePromise;
              await standalone?.close?.();
            } catch {
              // Ignore bridge teardown failures in test cleanup.
            }
          })(),
        );
      }
      delete bridgeGlobal[key];
    }
  }

  await Promise.all(cleanupTasks);
}

afterEach(async () => {
  process.env.NODE_ENV = originalNodeEnv;
  await clearBridgeGlobals();
});

describe("bridgesocket adapters", () => {
  it("withBridgeSocketNext injects bridge rewrites first", async () => {
    process.env.NODE_ENV = "development";
    const testBridgeKey = `${BRIDGESOCKET_NEXT_BRIDGE_GLOBAL_KEY}:test-adapters`;
    const bridgeGlobal = globalThis as typeof globalThis & {
      [key: string]: unknown;
    };

    bridgeGlobal[testBridgeKey] = Promise.resolve({
      baseUrl: "http://127.0.0.1:41234",
      bridge: {} as never,
      close: async () => undefined,
    });

    const config = withBridgeSocketNext(
      {
        rewrites: async () => [
          {
            source: "/docs/:path*",
            destination: "/docs",
          },
        ],
      },
      { nextBridgeGlobalKey: testBridgeKey },
    );

    const rewrites = await config.rewrites?.();
    if (!rewrites) {
      throw new Error("Expected rewrites to be defined");
    }
    const normalized = Array.isArray(rewrites)
      ? {
          beforeFiles: rewrites,
          afterFiles: [],
          fallback: [],
        }
      : rewrites;

    expect(normalized.beforeFiles[0]).toEqual({
      source: "/__bridgesocket/:path*",
      destination: "http://127.0.0.1:41234/__bridgesocket/:path*",
    });
    expect(normalized.beforeFiles[1]).toEqual({
      source: "/docs/:path*",
      destination: "/docs",
    });

    delete bridgeGlobal[testBridgeKey];
  });

  it("withBridgeSocketNext is a no-op in production", () => {
    process.env.NODE_ENV = "production";
    const config = { trailingSlash: true };
    const wrapped = withBridgeSocketNext(config);
    expect(wrapped).toBe(config);
  });

  it("withBridgeSocketNext creates isolated bridge instances by default", async () => {
    process.env.NODE_ENV = "development";
    const passthroughRule = { source: "/noop/:path*", destination: "/noop" };

    const first = withBridgeSocketNext({
      rewrites: async () => [passthroughRule],
    });
    const second = withBridgeSocketNext({
      rewrites: async () => [passthroughRule],
    });

    const firstRewrites = await first.rewrites?.();
    const secondRewrites = await second.rewrites?.();
    if (!firstRewrites || !secondRewrites) {
      throw new Error("Expected rewrites to be defined");
    }

    const firstNormalized = Array.isArray(firstRewrites)
      ? { beforeFiles: firstRewrites, afterFiles: [], fallback: [] }
      : firstRewrites;
    const secondNormalized = Array.isArray(secondRewrites)
      ? { beforeFiles: secondRewrites, afterFiles: [], fallback: [] }
      : secondRewrites;

    const firstDestination = firstNormalized.beforeFiles[0]?.destination;
    const secondDestination = secondNormalized.beforeFiles[0]?.destination;

    expect(firstDestination).toBeDefined();
    expect(secondDestination).toBeDefined();
    expect(firstDestination).not.toBe(secondDestination);
  });

  it("createBridgeSocketNuxtModule injects plugin hook only in dev", () => {
    const module = createBridgeSocketNuxtModule();
    const hooks: Record<string, (...args: unknown[]) => void> = {};
    module.setup(
      {},
      {
        options: { dev: true },
        hook: (name: string, listener: (...args: unknown[]) => void) => {
          hooks[name] = listener;
        },
      },
    );

    expect(typeof hooks["vite:extendConfig"]).toBe("function");

    const config: { plugins?: unknown[] } = {};
    hooks["vite:extendConfig"]?.(config);
    expect(Array.isArray(config.plugins)).toBe(true);
    expect((config.plugins?.length || 0) > 0).toBe(true);

    const prodHooks: Record<string, (...args: unknown[]) => void> = {};
    module.setup(
      {},
      {
        options: { dev: false },
        hook: (name: string, listener: (...args: unknown[]) => void) => {
          prodHooks[name] = listener;
        },
      },
    );
    expect(prodHooks["vite:extendConfig"]).toBeUndefined();
  });

  it("createBridgeSocketAstroIntegration wires setup and teardown hooks", async () => {
    const integration = createBridgeSocketAstroIntegration({
      autoStart: false,
    });
    const fixture = createMiddlewareAdapterServerFixture();

    await (
      integration.hooks["astro:server:setup"] as (context: {
        server: ReturnType<
          typeof createMiddlewareAdapterServerFixture
        >["server"];
      }) => Promise<void>
    )({ server: fixture.server });

    expect(fixture.getMiddlewareCount()).toBe(1);
    expect(fixture.getListenerCount("upgrade")).toBe(1);
    expect(fixture.getListenerCount("close")).toBe(1);

    await (integration.hooks["astro:server:done"] as () => Promise<void>)();
  });

  it("createBridgeSocketAngularCliProxyConfig returns proxy rules for bridge routes", async () => {
    const testBridgeKey = `${BRIDGESOCKET_NEXT_BRIDGE_GLOBAL_KEY}:angular-cli:test`;
    const bridgeGlobal = globalThis as typeof globalThis & {
      [key: string]: unknown;
    };

    bridgeGlobal[testBridgeKey] = Promise.resolve({
      baseUrl: "http://127.0.0.1:43210",
      bridge: {} as never,
      close: async () => undefined,
    });

    const proxyConfig = await createBridgeSocketAngularCliProxyConfig({
      angularCliBridgeGlobalKey: testBridgeKey,
    });
    expect(proxyConfig).toEqual({
      "/__bridgesocket": {
        target: "http://127.0.0.1:43210",
        secure: false,
        changeOrigin: false,
        ws: true,
        logLevel: "warn",
      },
      "/__bridgesocket/**": {
        target: "http://127.0.0.1:43210",
        secure: false,
        changeOrigin: false,
        ws: true,
        logLevel: "warn",
      },
    });

    const mergedProxyConfig = await withBridgeSocketAngularCliProxyConfig(
      {
        "/api": {
          target: "http://127.0.0.1:5000",
          secure: false,
          changeOrigin: false,
          ws: true,
          logLevel: "warn",
        },
      },
      {
        angularCliBridgeGlobalKey: testBridgeKey,
      },
    );
    expect(Object.keys(mergedProxyConfig)).toEqual([
      "/api",
      "/__bridgesocket",
      "/__bridgesocket/**",
    ]);

    delete bridgeGlobal[testBridgeKey];
  });

  it("createBridgeSocketVitePlugin configures Vite middleware bridge", async () => {
    const plugin = createBridgeSocketVitePlugin({ autoStart: false });
    const pluginObject = Array.isArray(plugin) ? plugin[0] : plugin;
    const fixture = createMiddlewareAdapterServerFixture();

    expect(pluginObject?.name).toBe("bridgesocket-bridge");
    expect(pluginObject?.enforce).toBe("pre");

    await pluginObject?.configureServer?.(fixture.server as never);
    expect(fixture.getMiddlewareCount()).toBe(1);
    expect(fixture.getListenerCount("upgrade")).toBe(1);
    expect(fixture.getListenerCount("close")).toBe(1);

    fixture.emit("close");
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
