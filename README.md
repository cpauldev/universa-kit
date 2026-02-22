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

DevSocket is a universal bridge for in-browser development tools that works across frameworks. It attaches to host dev servers and exposes a same-origin control plane (`/__devsocket/*`) so UIs can read runtime state, stream events, run runtime actions, and proxy runtime APIs consistently across Next.js, Angular, Vue, Astro, Nuxt, SvelteKit, TanStack Start, Remix, and more.

## Who Should Use This

| You are...                                                  | Should you use DevSocket directly? | Why                                                                                          |
| ----------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| Building a developer tool (overlay/sidebar/control panel)   | Yes                                | DevSocket provides framework adapters, bridge routes, runtime control, and event streaming.  |
| Building an app with custom internal developer tooling      | Yes                                | Use DevSocket directly to mount same-origin bridge APIs and optional runtime control in dev. |
| Using a tool that already ships its own overlay integration | No                                 | Use that tool's setup instructions; the tool author already integrates DevSocket for you.    |

## Table Of Contents

- [Why DevSocket Matters](#why-devsocket-matters)
- [What It Provides](#what-it-provides)
- [Representative Use Cases](#representative-use-cases)
- [Install](#install)
- [Quick Start (Tool Authors)](#quick-start-tool-authors)
- [Integration Surfaces (How To Choose)](#integration-surfaces-how-to-choose)
- [Runtime Modes](#runtime-modes)
- [Architecture](#architecture)
- [Configuration Reference](#configuration-reference)
- [Bridge Routes](#bridge-routes)
- [Bridge Events](#bridge-events)
- [Client API (`devsocket/client`)](#client-api-devsocketclient)
- [Documentation Set](#documentation-set)
- [Framework Adapters](#framework-adapters)
- [Server Adapters](#server-adapters)
- [Build-Tool Adapters](#build-tool-adapters)
- [Next.js Bridge Keys](#nextjs-bridge-keys)
- [Exports](#exports)
- [Compatibility](#compatibility)
- [Documentation Guardrails](#documentation-guardrails)
- [Packaging](#packaging)

## Why DevSocket Matters

DevSocket is infrastructure for local development tools.

Imagine you’re building or integrating a service that appears next to a localhost app as an overlay, sidebar, or control panel, and you want it to run across frameworks instead of being tied to one (Next.js, Angular, Vue, Astro, Nuxt, SvelteKit, TanStack Start, Remix, and more).

Frameworks, servers, and build tools all expose different hooks, so teams either reimplement the same integration work, support only one stack, or avoid building the product because cross-framework setup is too complex.

DevSocket solves this with a shared adapter layer and a consistent same-origin bridge contract (`/__devsocket/*`), so you can focus on product behavior and UX while it handles connection and runtime orchestration. The result is a consistent developer experience across supported stacks when users run their dev server.

_DevSocket primarily targets browser-based dev UIs, but the same bridge also works for non-UI local clients such as scripts and CLIs._

## What It Provides

DevSocket gives you:

- same-origin bridge routes (default prefix: `/__devsocket`)
- runtime lifecycle control (`start`, `restart` require `command`; `stop` is idempotent)
- runtime status state for your UI
- versioned bridge contract (`protocolVersion: "1"`) on bridge state/health
- WebSocket event stream (`/__devsocket/events`) with ordered event IDs
- API proxying from host origin to runtime origin (`/__devsocket/api/*`)
- proxy fidelity for binary request payloads and multi-value `Set-Cookie` response headers
- typed browser/Node client helpers via `devsocket/client`
- framework/server/build-tool adapters so the bridge is attached where dev servers actually run

DevSocket does not include:

- a UI/overlay implementation
- framework app scaffolding
- cloud services

## Representative Use Cases

| Use case                                                                                                | DevSocket provides                                                                                                                    | You implement                                                                                                                                |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-framework SaaS products with account and subscription flows                                       | Framework/server/build-tool adapters, same-origin bridge routes, browser-to-runtime transport, and same-origin API proxy              | Product UX, auth/session flows, account and subscription logic, entitlement enforcement, and framework-specific polish beyond adapter wiring |
| AI code-assistance overlays with page annotations (draw, select components, leave notes for AI changes) | Same-origin bridge routes, browser-to-runtime transport, runtime control endpoints, and live bridge state/events                      | Model orchestration, prompt/workflow design, page annotation UX, browser automation, and safety/review policies                              |
| App store and extension ecosystems                                                                      | Same-origin bridge contract, browser-to-runtime transport, and runtime control endpoints for extension tooling                        | Extension packaging, trust/permission model, lifecycle management, and marketplace UX                                                        |
| UI component-library drag-and-drop and page editing tools                                               | Same-origin bridge routes, browser-to-runtime transport, live bridge state/events, and runtime lifecycle controls                     | Component-canvas UX, drag/drop composition, inline page editing logic, and content/layout persistence                                        |
| Error handling, debugging, and AI-assisted remediation workflows                                        | Same-origin bridge routes, browser-to-runtime transport, live bridge state/events, and runtime lifecycle controls                     | Triage UX, diagnostics pipelines, root-cause/remediation logic, and human approval policies                                                  |
| Localization and internationalization management systems                                                | Same-origin bridge routes, browser-to-runtime transport, same-origin API proxy, and runtime lifecycle controls for language workflows | Translation UX, glossary/rule management, locale workflows, and provider integrations                                                        |

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

## Quick Start (Tool Authors)

Vite example:

```ts
// vite.config.ts
import { createDevSocketPlugin } from "devsocket/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    createDevSocketPlugin({
      command: "node",
      args: ["./scripts/dev-runtime.js"],
    }),
  ],
});
```

If your package wraps this integration, your end users typically only install your package and run their usual `dev` command.

## Integration Surfaces (How To Choose)

DevSocket has different adapter surfaces because frameworks, servers, and build tools expose different integration hooks.

Use this decision table first:

| Your host setup                                                                                   | Import path             | Why                                                   |
| ------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------- |
| Vite-based framework (Vue, SvelteKit, TanStack Start, Remix, React Router, Angular Vite pipeline) | `devsocket/vite`        | Single plugin path for Vite pipelines.                |
| Next.js                                                                                           | `devsocket/next`        | Next-specific wrapper and rewrite flow.               |
| Nuxt                                                                                              | `devsocket/nuxt`        | Nuxt module lifecycle integration.                    |
| Astro                                                                                             | `devsocket/astro`       | Astro integration hooks.                              |
| Angular CLI (not Vite pipeline)                                                                   | `devsocket/angular/cli` | Proxy-config based bridge integration for `ng serve`. |
| `Bun.serve` host server                                                                           | `devsocket/bun`         | Bun-native `fetch`/`websocket` handler integration.   |
| Custom Node HTTP server (Express/connect style middleware)                                        | `devsocket/node`        | Direct middleware + HTTP server bridge attach.        |
| Fastify server                                                                                    | `devsocket/fastify`     | Fastify lifecycle and request hook integration.       |
| Hono on Node server                                                                               | `devsocket/hono`        | Hono Node server attachment helper.                   |
| Direct webpack-dev-server config                                                                  | `devsocket/webpack`     | Build-tool level middleware wiring.                   |
| Direct Rsbuild config                                                                             | `devsocket/rsbuild`     | Build-tool level middleware wiring.                   |
| Direct Rspack config                                                                              | `devsocket/rspack`      | Build-tool level middleware wiring.                   |

Runtime note:

- `devsocket/node` refers to a Node-style server interface, not only Node runtime.
- For `Bun.serve`, use `devsocket/bun`.
- DevSocket supports Node and Bun runtimes.

## Runtime Modes

Managed runtime mode:

- provide `command` (and optional `args`)
- bridge can auto-start runtime and handle lifecycle

```ts
{
  command: "node",
  args: ["./scripts/dev-runtime.js"],
  fallbackCommand: "npm run dev-runtime"
}
```

Bridge-only mode:

- disable runtime auto-start
- omit runtime command if you only need bridge transport/status routes

```ts
{
  autoStart: false;
}
```

Important behavior:

- `autoStart` defaults to `true`
- if runtime start is triggered but `command` is missing, start/restart/proxy-to-runtime paths return an error by design
- runtime control capability flags in bridge state are `false` when `command` is not configured
- `POST /runtime/stop` remains safe/idempotent even without a configured runtime command

## Architecture

1. Your framework dev server runs (Vite, Next, Nuxt, etc.).
2. DevSocket attaches a bridge to that server.
3. Your UI calls bridge routes on the same host origin.
4. The bridge optionally manages a separate runtime process via `RuntimeHelper`.
5. Runtime API calls can flow through `/__devsocket/api/*` so the browser stays same-origin.

## Configuration Reference

All adapters accept `DevSocketAdapterOptions`, which extends bridge and runtime options.

Core bridge/runtime options:

| Option                     | Type                                  | Default                    | Notes                                                  |
| -------------------------- | ------------------------------------- | -------------------------- | ------------------------------------------------------ |
| `autoStart`                | `boolean`                             | `true`                     | Auto-start runtime on state/proxy/event paths          |
| `bridgePathPrefix`         | `string`                              | `"/__devsocket"`           | Route prefix for bridge endpoints                      |
| `fallbackCommand`          | `string`                              | `"devsocket dev"`          | Returned in error payloads for recovery UX             |
| `command`                  | `string`                              | none                       | Required for managed runtime lifecycle                 |
| `args`                     | `string[]`                            | `[]`                       | Runtime process args                                   |
| `cwd`                      | `string`                              | `process.cwd()`            | Runtime working directory                              |
| `env`                      | `Record<string, string \| undefined>` | none                       | Extra runtime env vars                                 |
| `host`                     | `string`                              | `"127.0.0.1"`              | Runtime host binding                                   |
| `healthPath`               | `string`                              | `"/api/version"`           | Health probe path used after spawn                     |
| `startTimeoutMs`           | `number`                              | `15000`                    | Runtime health timeout                                 |
| `runtimePortEnvVar`        | `string`                              | `"DEVSOCKET_RUNTIME_PORT"` | Env var populated with allocated port                  |
| `eventHeartbeatIntervalMs` | `number`                              | `30000`                    | Ping interval used to terminate stale event WS clients |

Adapter-focused options:

| Option                | Type     | Default                        | Notes                                |
| --------------------- | -------- | ------------------------------ | ------------------------------------ |
| `adapterName`         | `string` | `"devsocket-bridge"`           | Plugin/module name where applicable  |
| `rewriteSource`       | `string` | `"/__devsocket/:path*"`        | Rewrite pattern used by Next wrapper |
| `nextBridgeGlobalKey` | `string` | auto-generated in Next wrapper | Override for Next standalone keying  |

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
- bridge routes support query strings (for example `GET /__devsocket/state?source=ui`).
- `POST /runtime/stop` disables auto-start until `start`/`restart` is called again.
- bridge-generated error responses use a standard envelope: `{ success: false, message, error: { code, message, retryable, details? } }`.
- proxied `/api/*` responses preserve upstream status/body/headers and are not envelope-wrapped by default.

## Bridge Events

Current event union:

- `runtime-status`
- `runtime-error`

Bridge-emitted events include:

- `protocolVersion` (currently `"1"`)
- `eventId` (monotonic sequence per bridge instance)
- `timestamp`

WebSocket subprotocol:

- supported: `devsocket.v1+json`
- if the client sends `Sec-WebSocket-Protocol`, the offered list must include `devsocket.v1+json`; otherwise the bridge rejects with `426`
- when accepted, the bridge selects `devsocket.v1+json` as the negotiated subprotocol

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

Node WebSocket implementations can be passed with `webSocketFactory` when needed.

## Documentation Set

- `README.md`: product overview, installation, and integration entrypoints.
- `PROTOCOL.md`: normative bridge contract (routes, events, errors, and versioning).
- `ARCHITECTURE.md`: internal component boundaries and data flow.

## Framework Adapters

Use `devsocket/vite` for any Vite-based stack.
Use `devsocket/angular/cli` for Angular CLI proxy integration.

### Next.js

```ts
// next.config.ts
import { withDevSocket } from "devsocket/next";

const nextConfig = {
  reactStrictMode: true,
};

export default withDevSocket(nextConfig, {
  command: "node",
  args: ["./scripts/dev-runtime.js"],
});
```

### Astro

```ts
// astro.config.ts
import { defineConfig } from "astro/config";
import { devSocketAstro } from "devsocket/astro";

export default defineConfig({
  integrations: [devSocketAstro()],
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

Then start Angular CLI with the generated proxy config:

```bash
node devsocket.proxy.mjs
ng serve --proxy-config proxy.devsocket.json
```

### Vite (recommended for Vite-based frameworks)

```ts
// vite.config.ts
import { createDevSocketPlugin } from "devsocket/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [createDevSocketPlugin()],
});
```

This single import works for Vite-based stacks such as Vue, Angular (Vite pipeline), SvelteKit, TanStack Start, Remix, and React Router.

### Nuxt

```ts
// nuxt.config.ts
import { defineDevSocketNuxtModule } from "devsocket/nuxt";
import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  modules: [defineDevSocketNuxtModule()],
});
```

## Server Adapters

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
  fetch: withDevSocketBunServeFetch((request) => {
    return new Response(`app route: ${new URL(request.url).pathname}`);
  }, devsocket),
  websocket: withDevSocketBunServeWebSocketHandlers(devsocket),
});

// Later, on shutdown:
await devsocket.close();
server.stop();
```

### Node (middleware + HTTP server)

```ts
import { attachDevSocketToNodeServer } from "devsocket/node";
import express from "express";
import http from "node:http";

const app = express();
const server = http.createServer(app);

await attachDevSocketToNodeServer(
  {
    middlewares: {
      use: app.use.bind(app),
    },
    httpServer: server,
  },
  {
    command: "node",
    args: ["./scripts/dev-runtime.js"],
  },
);
```

### Fastify

```ts
import { attachDevSocketToFastify } from "devsocket/fastify";
import Fastify from "fastify";

const fastify = Fastify();
await attachDevSocketToFastify(fastify, {
  command: "node",
  args: ["./scripts/dev-runtime.js"],
});
```

### Hono (Node server integration)

```ts
import { attachDevSocketToHonoNodeServer } from "devsocket/hono";

await attachDevSocketToHonoNodeServer(
  {
    middlewares: { use: app.use.bind(app) },
    httpServer: server,
  },
  { autoStart: false },
);
```

## Build-Tool Adapters

### Webpack Dev Server

```ts
import { withDevSocketWebpackDevServer } from "devsocket/webpack";

export default {
  devServer: withDevSocketWebpackDevServer({
    setupMiddlewares: (middlewares) => middlewares,
  }),
};
```

### Rsbuild

```ts
import { withDevSocketRsbuild } from "devsocket/rsbuild";

export default {
  devServer: withDevSocketRsbuild({
    setupMiddlewares: (middlewares) => middlewares,
  }),
};
```

### Rspack

```ts
import { withDevSocketRspack } from "devsocket/rspack";

export default {
  devServer: withDevSocketRspack({
    setupMiddlewares: (middlewares) => middlewares,
  }),
};
```

## Next.js Bridge Keys

`withDevSocket(nextConfig, options)` uses a standalone bridge behind rewrites in development.

Default behavior:

- each wrapper call gets a unique per-instance key
- this avoids collisions when multiple Next servers run in the same process

Optional override:

- set `nextBridgeGlobalKey` when you need deterministic keying or intentionally shared bridge state

```ts
import { withDevSocket } from "devsocket/next";

export default withDevSocket(
  { reactStrictMode: true },
  {
    nextBridgeGlobalKey: "__DEVSOCKET_NEXT_BRIDGE__:workspace-a",
  },
);
```

## Exports

Primary package exports from `devsocket`:

- bridge: `createDevSocketBridge`, `startStandaloneDevSocketBridgeServer`, `DevSocketBridge`
- Vite/unplugin: `createDevSocketPlugin` (recommended via `devsocket/vite`), `devSocketUnplugin`
- framework: `withDevSocket`, `createDevSocketAngularCliProxyConfig`, `startDevSocketAngularCliBridge`, `withDevSocketAngularCliProxyConfig`, `devSocketAstro`, `defineDevSocketNuxtModule`
- server/build: `attachDevSocketToBunServe`, `withDevSocketBunServeFetch`, `withDevSocketBunServeWebSocketHandlers`, `attachDevSocketToNodeServer`, `attachDevSocketToFastify`, `attachDevSocketToHonoNodeServer`, `withDevSocketWebpackDevServer`, `withDevSocketRsbuild`, `withDevSocketRspack`
- runtime helper: `RuntimeHelper`
- typed client API: `createDevSocketClient`, `DevSocketClientError`
- shared types: runtime state, bridge state, capability, command, and event types
- protocol constants: `DEVSOCKET_PROTOCOL_VERSION`, `DEVSOCKET_WS_SUBPROTOCOL`

Subpath exports:

- `devsocket/vite` (recommended default for Vite-based stacks)
- `devsocket/next`
- `devsocket/angular/cli`
- `devsocket/astro`
- `devsocket/nuxt`
- `devsocket/bun`
- `devsocket/node`
- `devsocket/fastify`
- `devsocket/hono`
- `devsocket/webpack`
- `devsocket/rsbuild`
- `devsocket/rspack`
- `devsocket/internal` (internal helpers, not stable API)
- `devsocket/client`

## Compatibility

- runtime support target: Node.js and Bun
- module format: ESM package (`"type": "module"`)
- CI matrix: Node `20.x`, Node `22.x`, Bun `1.3.9`
- validated by:
  - unit tests
  - adapter integration tests
  - e2e runtime control tests
  - e2e bridge event flow tests

## Documentation Guardrails

- `bun run docs:lint` validates markdown docs.
- `bun run docs:check` enforces docs synchronization for protocol/API-impacting source changes.
- Required docs updates for impacted changes:
  - `README.md`
  - `PROTOCOL.md`

## Packaging

Published artifacts are built from `src/` into `dist/` with declaration files:

- runtime JS and `.d.ts` output in `dist`
- package includes `README.md` and `LICENSE`
- release guard via `prepublishOnly`: build + test + typecheck
