# Universa Integration Guide

This guide shows how to ship a tool package that exposes one integration API and works across frameworks via UniversaKit.

## 1) Build a runtime command

Your tool runtime should listen on the port provided by `UNIVERSA_RUNTIME_PORT` (default env var used by UniversaKit).

```js
// runtime/dev-server.mjs
import { createServer } from "node:http";

const port = Number(process.env.UNIVERSA_RUNTIME_PORT ?? 3456);

const server = createServer((req, res) => {
  if (req.url === "/api/version") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ version: "0.1.0" }));
    return;
  }

  if (req.url === "/api/status") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, tool: "acmetool" }));
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[acmetool] runtime listening on http://127.0.0.1:${port}`);
});
```

```js
#!/usr/bin/env node
// bin/acmetool.mjs
const command = process.argv[2];

if (command === "dev") {
  await import("../runtime/dev-server.mjs");
} else if (command === "setup") {
  console.log("acmetool setup: write project config files here.");
} else {
  console.log("Usage: acmetool <setup|dev>");
  process.exit(1);
}
```

## 2) Export a preset (recommended)

```ts
// src/index.ts
import { createUniversaPreset } from "universa-kit/preset";

export function acmetool() {
  return createUniversaPreset({
    identity: { packageName: "acmetool" },
    command: "acmetool",
    args: ["dev"],
    fallbackCommand: "acmetool dev",
  });
}
```

Why presets are recommended:

- users import from one place (`acmetool`)
- namespace + bridge prefix are derived automatically
- framework adapters can compose safely when multiple presets are present

## 3) User integration examples

### Next.js

```ts
// next.config.ts
import { acmetool } from "acmetool";

export default acmetool().next({});
```

### Vite

```ts
// vite.config.ts
import { acmetool } from "acmetool";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [acmetool().vite()],
});
```

Then users run their normal app dev command.

## 4) Bridge routes users get

Preset integrations are namespaced:

- `GET /__universa/acmetool/health`
- `GET /__universa/acmetool/state`
- `WS /__universa/acmetool/events`
- `ANY /__universa/acmetool/api/*`

## 5) Optional browser overlay client

```ts
import { createUniversaClient } from "universa-kit/client";

const client = createUniversaClient({ namespaceId: "acmetool" });
const state = await client.getState();
console.log(state.runtime.phase);

const unsubscribe = client.subscribeEvents((event) => {
  if (event.type === "runtime-status") {
    console.log(event.status.phase);
  }
});

window.addEventListener("beforeunload", () => unsubscribe());
```

## 6) Important notes

- If `command` is omitted, `start`/`restart` runtime controls are unavailable by design.
- `stop` remains idempotent.
- `bridgePathPrefix` is normalized under `/__universa`.
- Keep your public API stable (`acmetool().vite()`, `acmetool().next(...)`, etc.).

## 7) Preset composition

- `createUniversaPreset` defaults to `composition: "registry"`.
- In `"registry"` mode, framework/build adapters compose all registered presets (`vite`, `next`, `nuxt`, `astro`, `webpack`, `rsbuild`, `rspack`).
- In `"local"` mode, a preset only applies its own framework/build wiring.
- Imperative adapters remain local to each preset instance (`bun`, `node`, `fastify`, `hono`, `angularCli`).

## 8) Public API coverage

### Core bridge and preset APIs

| API                                       | Import path           | Purpose                                        |
| ----------------------------------------- | --------------------- | ---------------------------------------------- |
| `createUniversaPreset`                    | `universa-kit/preset` | Unified integration surface for tool packages. |
| `createUniversaBridge` / `UniversaBridge` | `universa-kit`        | Direct bridge instance control and attachment. |
| `startStandaloneUniversaBridgeServer`     | `universa-kit`        | Standalone bridge server for tooling/tests.    |

### Client SDK and runtime-context helpers

| API                                                              | Import path                   | Purpose                                                    |
| ---------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------- |
| `createUniversaClient` / `UniversaClientError`                   | `universa-kit/client`         | Typed health/state/runtime/event client.                   |
| `createClientRuntimeContext`                                     | `universa-kit/client-runtime` | Create normalized namespace runtime context.               |
| `registerClientRuntimeContext` / `registerClientRuntimeContexts` | `universa-kit/client-runtime` | Register module-to-context mappings.                       |
| `getClientRuntimeContexts` / `resolveClientRuntimeContext`       | `universa-kit/client-runtime` | Read/resolve runtime contexts.                             |
| `resolveClientAutoMount`                                         | `universa-kit/client-runtime` | Evaluate effective auto-mount from query/storage/defaults. |

### Framework adapters

| API                                   | Import path                |
| ------------------------------------- | -------------------------- |
| `createUniversaVitePlugin`            | `universa-kit/vite`        |
| `withUniversaNext`                    | `universa-kit/next`        |
| `createUniversaAstroIntegration`      | `universa-kit/astro`       |
| `createUniversaNuxtModule`            | `universa-kit/nuxt`        |
| `startUniversaAngularCliBridge`       | `universa-kit/angular/cli` |
| `createUniversaAngularCliProxyConfig` | `universa-kit/angular/cli` |
| `withUniversaAngularCliProxyConfig`   | `universa-kit/angular/cli` |

### Server adapters

| API                                     | Import path            |
| --------------------------------------- | ---------------------- |
| `attachUniversaToBunServe`              | `universa-kit/bun`     |
| `withUniversaBunServeFetch`             | `universa-kit/bun`     |
| `withUniversaBunServeWebSocketHandlers` | `universa-kit/bun`     |
| `attachUniversaToNodeServer`            | `universa-kit/node`    |
| `attachUniversaToFastify`               | `universa-kit/fastify` |
| `attachUniversaToHonoNodeServer`        | `universa-kit/hono`    |

### Build adapters and lifecycle helpers

| API                            | Import path            |
| ------------------------------ | ---------------------- |
| `withUniversaWebpackDevServer` | `universa-kit/webpack` |
| `withUniversaRsbuild`          | `universa-kit/rsbuild` |
| `withUniversaRspack`           | `universa-kit/rspack`  |
| `createWebpackBridgeLifecycle` | `universa-kit/webpack` |
| `createRsbuildBridgeLifecycle` | `universa-kit/rsbuild` |
| `createRspackBridgeLifecycle`  | `universa-kit/rspack`  |
| `createNodeBridgeLifecycle`    | `universa-kit/node`    |
| `createHonoBridgeLifecycle`    | `universa-kit/hono`    |

### Runtime helper and protocol constants

| API                         | Import path    |
| --------------------------- | -------------- |
| `RuntimeHelper`             | `universa-kit` |
| `UNIVERSA_PROTOCOL_VERSION` | `universa-kit` |
| `UNIVERSA_WS_SUBPROTOCOL`   | `universa-kit` |

For the full public export list (including types), use `src/index.ts` as the source of truth.

## 9) Adapter-specific notes (when presets are not your integration surface)

If you expose framework-specific APIs instead of a preset, keep these behaviors documented for users.

### Next.js bridge keying

`withUniversaNext` creates isolated bridge keys by default. You can set `nextBridgeGlobalKey` for deterministic keying.

```ts
import { withUniversaNext } from "universa-kit/next";

export default withUniversaNext(
  {},
  {
    nextBridgeGlobalKey: "__UNIVERSA_NEXT_BRIDGE__:workspace-a",
  },
);
```

### Bun.serve integration

```ts
import {
  attachUniversaToBunServe,
  withUniversaBunServeFetch,
  withUniversaBunServeWebSocketHandlers,
} from "universa-kit/bun";

const universa = await attachUniversaToBunServe({
  command: "acmetool",
  args: ["dev"],
});

const server = Bun.serve({
  fetch: withUniversaBunServeFetch((request) => new Response("ok"), universa),
  websocket: withUniversaBunServeWebSocketHandlers(universa),
});

// cleanup
await universa.close();
server.stop();
```

### Node server integration

```ts
import express from "express";
import http from "node:http";
import { attachUniversaToNodeServer } from "universa-kit/node";

const app = express();
const server = http.createServer(app);

await attachUniversaToNodeServer(
  {
    middlewares: { use: app.use.bind(app) },
    httpServer: server,
  },
  {
    command: "acmetool",
    args: ["dev"],
  },
);
```

### webpack-dev-server integration

```ts
import { withUniversaWebpackDevServer } from "universa-kit/webpack";

export default {
  devServer: withUniversaWebpackDevServer({
    setupMiddlewares: (middlewares) => middlewares,
  }),
};
```

### Fastify integration

```ts
import Fastify from "fastify";
import { attachUniversaToFastify } from "universa-kit/fastify";

const fastify = Fastify();

await attachUniversaToFastify(fastify, {
  command: "acmetool",
  args: ["dev"],
});
```

### Hono (Node server) integration

`attachUniversaToHonoNodeServer` uses the same Node-style server surface as `attachUniversaToNodeServer`.

```ts
import { attachUniversaToHonoNodeServer } from "universa-kit/hono";

await attachUniversaToHonoNodeServer(
  {
    middlewares: {
      use: (handler) => {
        // register the handler on your Node HTTP middleware chain
      },
    },
    httpServer,
  },
  {
    command: "acmetool",
    args: ["dev"],
  },
);
```

### Rsbuild and Rspack integration

```ts
import { withUniversaRsbuild } from "universa-kit/rsbuild";
import { withUniversaRspack } from "universa-kit/rspack";

export const rsbuildConfig = withUniversaRsbuild({});
export const rspackConfig = withUniversaRspack({});
```

### Astro and Nuxt integration

```ts
import { defineConfig as defineAstroConfig } from "astro/config";
import { createUniversaAstroIntegration } from "universa-kit/astro";

export default defineAstroConfig({
  integrations: [createUniversaAstroIntegration()],
});
```

```ts
import { defineNuxtConfig } from "nuxt/config";
import { createUniversaNuxtModule } from "universa-kit/nuxt";

export default defineNuxtConfig({
  modules: [createUniversaNuxtModule()],
});
```

### Angular CLI proxy integration

```ts
import { createUniversaAngularCliProxyConfig } from "universa-kit/angular/cli";

const proxyConfig = await createUniversaAngularCliProxyConfig({
  command: "acmetool",
  args: ["dev"],
});
```

### Standalone bridge (tooling/tests)

```ts
import { startStandaloneUniversaBridgeServer } from "universa-kit";

const standalone = await startStandaloneUniversaBridgeServer({
  command: "acmetool",
  args: ["dev"],
});

console.log(standalone.baseUrl);
await standalone.close();
```
