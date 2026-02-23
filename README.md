# DevSocket 🪼

<p align="center">
  <img src="assets/jellyfishy.png" alt="DevSocket jellyfish mascot" width="80" style="vertical-align: middle;" />
  <img src="assets/devsocket-logo.png" alt="DevSocket logo" width="420" style="vertical-align: middle;" />
</p>

<p align="center">
  <a href="https://github.com/cpauldev/devsocket/actions/workflows/ci.yml"><img alt="build" src="https://img.shields.io/github/actions/workflow/status/cpauldev/devsocket/ci.yml?branch=main&style=for-the-badge&label=build" height="28" style="vertical-align: middle;" /></a>
  <a href="https://github.com/cpauldev/devsocket/releases"><img alt="release" src="https://img.shields.io/github/v/release/cpauldev/devsocket?style=for-the-badge&label=release" height="28" style="vertical-align: middle;" /></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" height="28" style="vertical-align: middle;" /></a>
</p>

DevSocket is a universal bridge for local development tools. It mounts a same-origin control plane (`/__devsocket/*`) on your host dev server so browser UIs and local clients can read state, stream events, control runtime lifecycle, and proxy runtime APIs consistently across frameworks.

## Who Should Use This

| You are...                                                | Should you use DevSocket directly? | Why                                                                                          |
| --------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| Building a developer tool (overlay/sidebar/control panel) | Yes                                | DevSocket provides framework adapters, bridge routes, runtime control, and event streaming.  |
| Building custom internal developer tooling                | Yes                                | Use DevSocket directly to mount same-origin bridge APIs and optional runtime control in dev. |
| Using a tool that already ships DevSocket integration     | No                                 | Follow that tool's setup instructions; the integration is already handled.                   |

## Table Of Contents

- [Why DevSocket Matters](#why-devsocket-matters)
- [What It Provides](#what-it-provides)
- [Common Use Cases](#common-use-cases)
- [Install](#install)
- [Quick Start](#quick-start)
- [Integration Surfaces](#integration-surfaces)
- [API Naming Patterns](#api-naming-patterns)
- [Configuration](#configuration)
- [Bridge Routes](#bridge-routes)
- [Bridge Events](#bridge-events)
- [Client API (`devsocket/client`)](#client-api-devsocketclient)
- [Adapter Examples](#adapter-examples)
- [Next.js Bridge Keys](#nextjs-bridge-keys)
- [Compatibility](#compatibility)
- [Documentation](#documentation)
- [Packaging](#packaging)

## Why DevSocket Matters

If you build a local dev tool that appears next to an app (overlay, sidebar, control panel), framework-specific integration becomes expensive fast. Frameworks, servers, and build tools expose different hooks, so teams either reimplement the same integration layer repeatedly, support one stack only, or skip the tool entirely.

DevSocket gives you one shared adapter and bridge layer so you can focus on product behavior and UX while DevSocket handles integration and transport.

DevSocket primarily targets browser-based dev UIs, but the same bridge also works for non-UI local clients such as scripts and CLIs.

## What It Provides

- same-origin bridge routes (default prefix: `/__devsocket`)
- runtime lifecycle control (`start`, `restart` require `command`; `stop` is idempotent)
- runtime status state for UI and automation
- versioned bridge contract (`protocolVersion: "1"`)
- websocket event stream (`/__devsocket/events`) with ordered event IDs
- API proxying from host origin to runtime origin (`/__devsocket/api/*`)
- binary proxy fidelity and multi-value `Set-Cookie` forwarding
- typed client helpers via `devsocket/client`
- framework/server/build-tool adapters

DevSocket does not include a first-party UI, app scaffolding, or hosted cloud services.

## Common Use Cases

- Cross-framework SaaS developer tools
- AI code-assistance overlays
- Local developer extension marketplaces
- Drag-and-drop UI composition and page editing tools
- Error triage, debugging, and remediation control panels
- Localization and internationalization management systems

## Install

```bash
npm i devsocket
```

```bash
pnpm add devsocket
```

```bash
yarn add devsocket
```

```bash
bun add devsocket
```

## Quick Start

```ts
// vite.config.ts
import { createDevSocketVitePlugin } from "devsocket/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    createDevSocketVitePlugin({
      command: "node",
      args: ["./scripts/dev-runtime.js"],
    }),
  ],
});
```

If your package wraps this integration, your end users typically only install your package and run their usual `dev` command.

## Integration Surfaces

| Host setup                                                                                        | Import path             | Use when                                         |
| ------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------ |
| Vite-based framework (Vue, SvelteKit, TanStack Start, Remix, React Router, Angular Vite pipeline) | `devsocket/vite`        | You want one Vite plugin path.                   |
| Next.js                                                                                           | `devsocket/next`        | You want a Next config wrapper and rewrite flow. |
| Nuxt                                                                                              | `devsocket/nuxt`        | You want a Nuxt module integration.              |
| Astro                                                                                             | `devsocket/astro`       | You want Astro integration hooks.                |
| Angular CLI (non-Vite pipeline)                                                                   | `devsocket/angular/cli` | You need generated proxy config for `ng serve`.  |
| `Bun.serve`                                                                                       | `devsocket/bun`         | You need Bun-native fetch/websocket handlers.    |
| Node middleware + HTTP server                                                                     | `devsocket/node`        | You want direct server attachment.               |
| Fastify                                                                                           | `devsocket/fastify`     | You want Fastify hook-based integration.         |
| Hono on Node server                                                                               | `devsocket/hono`        | You want Hono Node server attachment.            |
| webpack-dev-server                                                                                | `devsocket/webpack`     | You want build-tool level middleware wiring.     |
| Rsbuild                                                                                           | `devsocket/rsbuild`     | You want build-tool level middleware wiring.     |
| Rspack                                                                                            | `devsocket/rspack`      | You want build-tool level middleware wiring.     |

Runtime note:

- `devsocket/node` refers to a Node-style server interface, not Node-only runtime.
- for `Bun.serve`, use `devsocket/bun`.
- DevSocket supports Node and Bun runtimes.

## API Naming Patterns

| Pattern              | Meaning                                                     |
| -------------------- | ----------------------------------------------------------- |
| `createDevSocket*`   | Create a plugin/module/integration value.                   |
| `withDevSocket*`     | Wrap and return an updated config object.                   |
| `attachDevSocketTo*` | Imperatively attach DevSocket to a running server instance. |
| `startDevSocket*`    | Start a standalone bridge/helper and return a handle.       |

Common APIs:

| API                                    | Import path             |
| -------------------------------------- | ----------------------- |
| `createDevSocketVitePlugin`            | `devsocket/vite`        |
| `createDevSocketUnplugin`              | `devsocket`             |
| `withDevSocketNext`                    | `devsocket/next`        |
| `createDevSocketAstroIntegration`      | `devsocket/astro`       |
| `createDevSocketNuxtModule`            | `devsocket/nuxt`        |
| `createDevSocketAngularCliProxyConfig` | `devsocket/angular/cli` |
| `startDevSocketAngularCliBridge`       | `devsocket/angular/cli` |
| `withDevSocketAngularCliProxyConfig`   | `devsocket/angular/cli` |
| `attachDevSocketToBunServe`            | `devsocket/bun`         |
| `attachDevSocketToNodeServer`          | `devsocket/node`        |
| `attachDevSocketToFastify`             | `devsocket/fastify`     |
| `attachDevSocketToHonoNodeServer`      | `devsocket/hono`        |
| `withDevSocketWebpackDevServer`        | `devsocket/webpack`     |
| `withDevSocketRsbuild`                 | `devsocket/rsbuild`     |
| `withDevSocketRspack`                  | `devsocket/rspack`      |

## Configuration

All adapters accept `DevSocketAdapterOptions`, which extends bridge/runtime options.

Core options:

| Option                     | Type                                  | Default                    | Notes                                          |
| -------------------------- | ------------------------------------- | -------------------------- | ---------------------------------------------- |
| `autoStart`                | `boolean`                             | `true`                     | Auto-start runtime on state/proxy/event paths. |
| `bridgePathPrefix`         | `string`                              | `"/__devsocket"`           | Route prefix for bridge endpoints.             |
| `fallbackCommand`          | `string`                              | `"devsocket dev"`          | Returned in error payloads for recovery UX.    |
| `command`                  | `string`                              | none                       | Required for managed runtime lifecycle.        |
| `args`                     | `string[]`                            | `[]`                       | Runtime process args.                          |
| `cwd`                      | `string`                              | `process.cwd()`            | Runtime working directory.                     |
| `env`                      | `Record<string, string \| undefined>` | none                       | Extra runtime env vars.                        |
| `host`                     | `string`                              | `"127.0.0.1"`              | Runtime host binding.                          |
| `healthPath`               | `string`                              | `"/api/version"`           | Health probe path used after spawn.            |
| `startTimeoutMs`           | `number`                              | `15000`                    | Runtime health timeout.                        |
| `runtimePortEnvVar`        | `string`                              | `"DEVSOCKET_RUNTIME_PORT"` | Env var populated with allocated port.         |
| `eventHeartbeatIntervalMs` | `number`                              | `30000`                    | Ping interval for stale WS client cleanup.     |

Adapter-specific options:

| Option                | Type     | Default                        | Notes                                              |
| --------------------- | -------- | ------------------------------ | -------------------------------------------------- |
| `adapterName`         | `string` | `"devsocket-bridge"`           | Plugin/module name where applicable.               |
| `rewriteSource`       | `string` | `"/__devsocket/:path*"`        | Rewrite pattern used by Next wrapper.              |
| `nextBridgeGlobalKey` | `string` | auto-generated in Next wrapper | Override for deterministic Next standalone keying. |

## Bridge Routes

With default prefix `/__devsocket`:

- `GET /__devsocket/health`
- `GET /__devsocket/state`
- `GET /__devsocket/runtime/status`
- `POST /__devsocket/runtime/start`
- `POST /__devsocket/runtime/restart`
- `POST /__devsocket/runtime/stop`
- `WS /__devsocket/events`
- `ANY /__devsocket/api/*` (proxied to runtime as `/api/*`)

Notes:

- `GET /state` may auto-start runtime when `autoStart` is enabled.
- bridge routes are query-safe (for example `GET /__devsocket/state?source=ui`).
- `POST /runtime/stop` disables auto-start until `start` or `restart` is called.
- bridge-generated errors use envelope shape: `{ success: false, message, error: { code, message, retryable, details? } }`.
- proxied `/api/*` responses pass through upstream status/body/headers and are not envelope-wrapped by default.

## Bridge Events

Current event union:

- `runtime-status`
- `runtime-error`

Bridge-emitted events include:

- `protocolVersion` (`"1"`)
- `eventId` (monotonic per bridge instance)
- `timestamp` (epoch milliseconds)

WebSocket subprotocol:

- supported: `devsocket.v1+json`
- if a client sends `Sec-WebSocket-Protocol`, the offered list must include `devsocket.v1+json`; otherwise the bridge rejects with `426`
- when accepted, the bridge negotiates `devsocket.v1+json`

Type source: `src/types.ts` (`DevSocketBridgeEvent`).

## Client API (`devsocket/client`)

```ts
import { createDevSocketClient } from "devsocket/client";

const client = createDevSocketClient({
  baseUrl: "http://127.0.0.1:3000",
});

const health = await client.getHealth();
const state = await client.getState();
const runtime = await client.startRuntime();

const unsubscribe = client.subscribeEvents((event) => {
  console.log(event.type, event.eventId);
});

unsubscribe();
```

In Node environments, pass a WebSocket implementation with `webSocketFactory` when needed.

## Adapter Examples

### Next.js

```ts
// next.config.ts
import { withDevSocketNext } from "devsocket/next";

export default withDevSocketNext(
  { reactStrictMode: true },
  {
    command: "node",
    args: ["./scripts/dev-runtime.js"],
  },
);
```

### Astro

```ts
// astro.config.ts
import { defineConfig } from "astro/config";
import { createDevSocketAstroIntegration } from "devsocket/astro";

export default defineConfig({
  integrations: [createDevSocketAstroIntegration()],
});
```

### Nuxt

```ts
// nuxt.config.ts
import { createDevSocketNuxtModule } from "devsocket/nuxt";
import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  modules: [createDevSocketNuxtModule()],
});
```

### Angular CLI (Proxy Config)

```ts
// devsocket.proxy.mjs
import { createDevSocketAngularCliProxyConfig } from "devsocket/angular/cli";
import { writeFile } from "node:fs/promises";

const proxyConfig = await createDevSocketAngularCliProxyConfig();
await writeFile(
  new URL("./proxy.devsocket.json", import.meta.url),
  JSON.stringify(proxyConfig, null, 2),
);
```

Then:

```bash
node devsocket.proxy.mjs
ng serve --proxy-config proxy.devsocket.json
```

### Bun.serve

```ts
import {
  attachDevSocketToBunServe,
  withDevSocketBunServeFetch,
  withDevSocketBunServeWebSocketHandlers,
} from "devsocket/bun";

const devsocket = await attachDevSocketToBunServe({
  command: "node",
  args: ["./scripts/dev-runtime.js"],
});

const server = Bun.serve({
  fetch: withDevSocketBunServeFetch(
    (request) => new Response(`route: ${new URL(request.url).pathname}`),
    devsocket,
  ),
  websocket: withDevSocketBunServeWebSocketHandlers(devsocket),
});

await devsocket.close();
server.stop();
```

### Node Server

```ts
import { attachDevSocketToNodeServer } from "devsocket/node";
import express from "express";
import http from "node:http";

const app = express();
const server = http.createServer(app);

await attachDevSocketToNodeServer(
  {
    middlewares: { use: app.use.bind(app) },
    httpServer: server,
  },
  { command: "node", args: ["./scripts/dev-runtime.js"] },
);
```

### Webpack Dev Server

```ts
import { withDevSocketWebpackDevServer } from "devsocket/webpack";

export default {
  devServer: withDevSocketWebpackDevServer({
    setupMiddlewares: (middlewares) => middlewares,
  }),
};
```

## Next.js Bridge Keys

`withDevSocketNext(nextConfig, options)` uses a standalone bridge behind rewrites in development.

Default behavior:

- each wrapper call gets a unique per-instance key
- this avoids collisions when multiple Next servers run in the same process

Optional override:

- set `nextBridgeGlobalKey` when you need deterministic keying or intentionally shared bridge state

```ts
import { withDevSocketNext } from "devsocket/next";

export default withDevSocketNext(
  { reactStrictMode: true },
  {
    nextBridgeGlobalKey: "__DEVSOCKET_NEXT_BRIDGE__:workspace-a",
  },
);
```

## Compatibility

- runtime support target: Node.js and Bun
- module format: ESM package (`"type": "module"`)
- CI matrix: Node `20.x`, Node `22.x`, Bun `1.3.9`
- validated by:
  - unit tests
  - adapter integration tests
  - e2e runtime control tests
  - e2e bridge event flow tests

## Documentation

- `README.md`: product overview, installation, and integration entrypoints
- `PROTOCOL.md`: normative bridge contract (routes, events, errors, versioning)
- `ARCHITECTURE.md`: internal component boundaries and data flow

Guardrails:

- `bun run docs:lint` validates markdown docs
- `bun run docs:check` enforces docs synchronization for protocol/API-impacting source changes

## Packaging

Published artifacts are built from `src/` into `dist/` with declaration files:

- runtime JS and `.d.ts` output in `dist`
- package includes `README.md`, `PROTOCOL.md`, `ARCHITECTURE.md`, and `LICENSE`
- release guard via `prepublishOnly`: build + test + typecheck
