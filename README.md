# DevSocket 🪼

Framework-agnostic bridge for dev overlays with same-origin APIs and runtime control.

DevSocket attaches to host dev servers and exposes a same-origin control plane (`/__devsocket/*`) so tool UIs can read runtime state, stream events, run runtime actions, and proxy runtime APIs consistently across frameworks.

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
- [Runtime Modes](#runtime-modes)
- [Architecture](#architecture)
- [Configuration Reference](#configuration-reference)
- [Bridge Routes](#bridge-routes)
- [Bridge Events](#bridge-events)
- [Framework Adapters](#framework-adapters)
- [Server Adapters](#server-adapters)
- [Build-Tool Adapters](#build-tool-adapters)
- [Next.js Bridge Keys](#nextjs-bridge-keys)
- [Exports](#exports)
- [Compatibility](#compatibility)
- [Packaging](#packaging)

## Why DevSocket Matters

DevSocket is infrastructure for browser-based developer tools.

If you build a dev overlay, sidebar, or control panel, you usually have to reimplement the same plumbing for every framework:

- attaching to each dev server
- exposing bridge routes
- managing runtime start/stop/restart
- handling events and API proxying

DevSocket gives you that plumbing as a shared layer with framework/server/build-tool adapters and a consistent same-origin bridge contract.

You build the product features and UI. DevSocket handles the integration and transport layer.

## What It Provides

DevSocket gives you:

- same-origin bridge routes (default prefix: `/__devsocket`)
- runtime lifecycle control (`start`, `restart`, `stop`) when `command` is configured
- runtime status state for your UI
- WebSocket event stream (`/__devsocket/events`)
- API proxying from host origin to runtime origin (`/__devsocket/api/*`)
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
bun add devsocket
```

## Quick Start (Tool Authors)

Vite example:

```ts
// vite.config.ts
import { createDevSocketPlugin } from "devsocket";
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

## Architecture

1. Your framework dev server runs (Vite, Next, Nuxt, etc.).
2. DevSocket attaches a bridge to that server.
3. Your UI calls bridge routes on the same host origin.
4. The bridge optionally manages a separate runtime process via `RuntimeHelper`.
5. Runtime API calls can flow through `/__devsocket/api/*` so the browser stays same-origin.

## Configuration Reference

All adapters accept `DevSocketAdapterOptions`, which extends bridge and runtime options.

Core bridge/runtime options:

| Option              | Type                                  | Default                    | Notes                                         |
| ------------------- | ------------------------------------- | -------------------------- | --------------------------------------------- |
| `autoStart`         | `boolean`                             | `true`                     | Auto-start runtime on state/proxy/event paths |
| `bridgePathPrefix`  | `string`                              | `"/__devsocket"`           | Route prefix for bridge endpoints             |
| `fallbackCommand`   | `string`                              | `"devsocket dev"`          | Returned in error payloads for recovery UX    |
| `command`           | `string`                              | none                       | Required for managed runtime lifecycle        |
| `args`              | `string[]`                            | `[]`                       | Runtime process args                          |
| `cwd`               | `string`                              | `process.cwd()`            | Runtime working directory                     |
| `env`               | `Record<string, string \| undefined>` | none                       | Extra runtime env vars                        |
| `host`              | `string`                              | `"127.0.0.1"`              | Runtime host binding                          |
| `healthPath`        | `string`                              | `"/api/version"`           | Health probe path used after spawn            |
| `startTimeoutMs`    | `number`                              | `15000`                    | Runtime health timeout                        |
| `runtimePortEnvVar` | `string`                              | `"DEVSOCKET_RUNTIME_PORT"` | Env var populated with allocated port         |

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
- `POST /runtime/stop` disables auto-start until `start`/`restart` is called again.
- unknown bridge routes return `404` with a JSON error payload.

## Bridge Events

Current event union:

- `runtime-status`
- `runtime-error`

Type source: `src/types.ts` (`DevSocketBridgeEvent`).

## Framework Adapters

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

### Nuxt

```ts
// nuxt.config.ts
import { defineDevSocketNuxtModule } from "devsocket/nuxt";
import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  modules: [defineDevSocketNuxtModule()],
});
```

### SvelteKit (Vite)

```ts
// vite.config.ts
import { sveltekit } from "@sveltejs/kit/vite";
import { devSocketSvelteKit } from "devsocket/sveltekit";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit(), devSocketSvelteKit()],
});
```

### Remix (Vite)

```ts
// vite.config.ts
import { devSocketRemix } from "devsocket/remix";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [devSocketRemix()],
});
```

### React Router (Vite)

```ts
// vite.config.ts
import { devSocketReactRouter } from "devsocket/remix";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [devSocketReactRouter()],
});
```

Use either Remix or React Router adapter for your stack, not both in the same config.

## Server Adapters

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
- Vite/unplugin: `createDevSocketPlugin`, `devSocketUnplugin`
- framework: `withDevSocket`, `devSocketAstro`, `defineDevSocketNuxtModule`, `devSocketSvelteKit`, `devSocketRemix`, `devSocketReactRouter`
- server/build: `attachDevSocketToNodeServer`, `attachDevSocketToFastify`, `attachDevSocketToHonoNodeServer`, `withDevSocketWebpackDevServer`, `withDevSocketRsbuild`, `withDevSocketRspack`
- runtime helper: `RuntimeHelper`
- shared types: runtime state, bridge state, capability, command, and event types

Subpath exports:

- `devsocket/next`
- `devsocket/astro`
- `devsocket/nuxt`
- `devsocket/sveltekit`
- `devsocket/remix`
- `devsocket/node`
- `devsocket/fastify`
- `devsocket/hono`
- `devsocket/webpack`
- `devsocket/rsbuild`
- `devsocket/rspack`
- `devsocket/internal` (internal helpers, not stable API)

## Compatibility

- runtime support target: Node.js and Bun
- module format: ESM package (`"type": "module"`)
- CI matrix: Node `20.x`, Node `22.x`, Bun `1.3.9`
- validated by:
  - unit tests
  - adapter integration tests
  - e2e runtime control tests
  - e2e bridge event flow tests

## Packaging

Published artifacts are built from `src/` into `dist/` with declaration files:

- runtime JS and `.d.ts` output in `dist`
- package includes `README.md` and `LICENSE`
- release guard via `prepublishOnly`: build + test + typecheck
