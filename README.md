# BridgeSocket 🪼

<p align="center">
  <img src="assets/jellyfishy.png" alt="BridgeSocket jellyfish mascot" width="80" style="vertical-align: middle;" />
  <img src="assets/bridgesocket-logo.png" alt="BridgeSocket logo" width="480" style="vertical-align: middle;" />
</p>

<p align="center">
  <a href="https://github.com/cpauldev/bridgesocket/actions/workflows/ci.yml"><img alt="build" src="https://img.shields.io/github/actions/workflow/status/cpauldev/bridgesocket/ci.yml?branch=main&style=for-the-badge&label=build" height="28" style="vertical-align: middle;" /></a>
  <a href="https://github.com/cpauldev/bridgesocket/releases"><img alt="release" src="https://img.shields.io/github/v/release/cpauldev/bridgesocket?style=for-the-badge&label=release" height="28" style="vertical-align: middle;" /></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" height="28" style="vertical-align: middle;" /></a>
</p>

**BridgeSocket** allows developers to build cross-framework companion applications that run locally during development as overlays, sidebars, and panels. Users can install your package, start their project's dev server, and get the same experience across Next.js, Angular, Vue, Astro, Nuxt, SvelteKit, TanStack Start, Remix, and more.

Because web development frameworks are not standardized, it has not been possible to create truly framework-agnostic apps and plugins, much like a Windows executable cannot run on macOS.

BridgeSocket is a universal bridge that mounts a same-origin control plane (`/__bridgesocket/*`) on your host dev server. This lets browser UIs and local clients read state, stream events, control the runtime lifecycle, and proxy runtime APIs consistently across frameworks. Businesses can now offer richer service experiences as web applications while reaching as many developers as possible.

_BridgeSocket primarily targets browser-based dev UIs, but the same bridge also works for non-UI local clients such as scripts and CLIs._

## Who Should Use This

| You are...                                                | Should you use BridgeSocket directly? | Why                                                                                             |
| --------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Building a developer tool (overlay/sidebar/control panel) | Yes                                   | BridgeSocket provides framework adapters, bridge routes, runtime control, and event streaming.  |
| Building custom internal developer tooling                | Yes                                   | Use BridgeSocket directly to mount same-origin bridge APIs and optional runtime control in dev. |
| Using a tool that already ships BridgeSocket integration  | No                                    | Follow that tool's setup instructions; the integration is already handled.                      |

## Table Of Contents

- [What It Provides](#what-it-provides)
- [Use Cases](#use-cases)
- [Install](#install)
- [Quick Start](#quick-start)
- [Integration Surfaces](#integration-surfaces)
- [API Naming Patterns](#api-naming-patterns)
- [Configuration](#configuration)
- [Bridge Routes](#bridge-routes)
- [Bridge Events](#bridge-events)
- [Client API (`bridgesocket/client`)](#client-api-bridgesocketclient)
- [Adapter Examples](#adapter-examples)
- [Next.js Bridge Keys](#nextjs-bridge-keys)
- [Compatibility](#compatibility)
- [Documentation](#documentation)
- [Packaging](#packaging)

## What It Provides

- same-origin bridge routes (default prefix: `/__bridgesocket`)
- runtime lifecycle control (`start`, `restart` require `command`; `stop` is idempotent)
- runtime status state for UI and automation
- versioned bridge contract (`protocolVersion: "1"`)
- websocket event stream (`/__bridgesocket/events`) with ordered event IDs
- API proxying from host origin to runtime origin (`/__bridgesocket/api/*`)
- binary proxy fidelity and multi-value `Set-Cookie` forwarding
- typed client helpers via `bridgesocket/client`
- framework/server/build-tool adapters

BridgeSocket does not include a first-party UI, app scaffolding, or hosted cloud services.

## Use Cases

- Cross-framework SaaS services with auth and subscription flows
- AI code-assistance overlays with page annotations
- Extension marketplaces for local development apps
- UI component-library drag-and-drop and page editing tools
- Error triage, debugging, and AI-assisted remediation workflows
- Localization and internationalization management systems

## Install

```bash
npm i bridgesocket
```

```bash
pnpm add bridgesocket
```

```bash
yarn add bridgesocket
```

```bash
bun add bridgesocket
```

## Quick Start

```ts
// vite.config.ts
import { createBridgeSocketVitePlugin } from "bridgesocket/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    createBridgeSocketVitePlugin({
      command: "node",
      args: ["./scripts/dev-runtime.js"],
    }),
  ],
});
```

If your package wraps this integration, your end users typically only install your package and run their usual `dev` command.

## Integration Surfaces

| Host setup                                                                                        | Import path                | Use when                                         |
| ------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------ |
| Vite-based framework (Vue, SvelteKit, TanStack Start, Remix, React Router, Angular Vite pipeline) | `bridgesocket/vite`        | You want one Vite plugin path.                   |
| Next.js                                                                                           | `bridgesocket/next`        | You want a Next config wrapper and rewrite flow. |
| Nuxt                                                                                              | `bridgesocket/nuxt`        | You want a Nuxt module integration.              |
| Astro                                                                                             | `bridgesocket/astro`       | You want Astro integration hooks.                |
| Angular CLI (non-Vite pipeline)                                                                   | `bridgesocket/angular/cli` | You need generated proxy config for `ng serve`.  |
| `Bun.serve`                                                                                       | `bridgesocket/bun`         | You need Bun-native fetch/websocket handlers.    |
| Node middleware + HTTP server                                                                     | `bridgesocket/node`        | You want direct server attachment.               |
| Fastify                                                                                           | `bridgesocket/fastify`     | You want Fastify hook-based integration.         |
| Hono on Node server                                                                               | `bridgesocket/hono`        | You want Hono Node server attachment.            |
| webpack-dev-server                                                                                | `bridgesocket/webpack`     | You want build-tool level middleware wiring.     |
| Rsbuild                                                                                           | `bridgesocket/rsbuild`     | You want build-tool level middleware wiring.     |
| Rspack                                                                                            | `bridgesocket/rspack`      | You want build-tool level middleware wiring.     |

Runtime note:

- `bridgesocket/node` refers to a Node-style server interface, not Node-only runtime.
- for `Bun.serve`, use `bridgesocket/bun`.
- BridgeSocket supports Node and Bun runtimes.

## API Naming Patterns

| Pattern                 | Meaning                                                        |
| ----------------------- | -------------------------------------------------------------- |
| `createBridgeSocket*`   | Create a plugin/module/integration value.                      |
| `withBridgeSocket*`     | Wrap and return an updated config object.                      |
| `attachBridgeSocketTo*` | Imperatively attach BridgeSocket to a running server instance. |
| `startBridgeSocket*`    | Start a standalone bridge/helper and return a handle.          |

Common APIs:

| API                                       | Import path                |
| ----------------------------------------- | -------------------------- |
| `createBridgeSocketToolPreset`            | `bridgesocket/preset`      |
| `createBridgeSocketVitePlugin`            | `bridgesocket/vite`        |
| `withBridgeSocketNext`                    | `bridgesocket/next`        |
| `createBridgeSocketAstroIntegration`      | `bridgesocket/astro`       |
| `createBridgeSocketNuxtModule`            | `bridgesocket/nuxt`        |
| `createBridgeSocketAngularCliProxyConfig` | `bridgesocket/angular/cli` |
| `startBridgeSocketAngularCliBridge`       | `bridgesocket/angular/cli` |
| `withBridgeSocketAngularCliProxyConfig`   | `bridgesocket/angular/cli` |
| `attachBridgeSocketToBunServe`            | `bridgesocket/bun`         |
| `attachBridgeSocketToNodeServer`          | `bridgesocket/node`        |
| `attachBridgeSocketToFastify`             | `bridgesocket/fastify`     |
| `attachBridgeSocketToHonoNodeServer`      | `bridgesocket/hono`        |
| `withBridgeSocketWebpackDevServer`        | `bridgesocket/webpack`     |
| `withBridgeSocketRsbuild`                 | `bridgesocket/rsbuild`     |
| `withBridgeSocketRspack`                  | `bridgesocket/rspack`      |

Preset helper (for tool packages that want one unified export):

```ts
import { createBridgeSocketToolPreset } from "bridgesocket/preset";

export const myTool = createBridgeSocketToolPreset({
  command: "mytool",
  args: ["dev"],
  fallbackCommand: "mytool dev",
});
```

## Configuration

All adapters accept `BridgeSocketAdapterOptions`, which extends bridge/runtime options.

Core options:

| Option                     | Type                                  | Default                       | Notes                                          |
| -------------------------- | ------------------------------------- | ----------------------------- | ---------------------------------------------- |
| `autoStart`                | `boolean`                             | `true`                        | Auto-start runtime on state/proxy/event paths. |
| `bridgePathPrefix`         | `string`                              | `"/__bridgesocket"`           | Route prefix for bridge endpoints.             |
| `fallbackCommand`          | `string`                              | `"bridgesocket dev"`          | Returned in error payloads for recovery UX.    |
| `command`                  | `string`                              | none                          | Required for managed runtime lifecycle.        |
| `args`                     | `string[]`                            | `[]`                          | Runtime process args.                          |
| `cwd`                      | `string`                              | `process.cwd()`               | Runtime working directory.                     |
| `env`                      | `Record<string, string \| undefined>` | none                          | Extra runtime env vars.                        |
| `host`                     | `string`                              | `"127.0.0.1"`                 | Runtime host binding.                          |
| `healthPath`               | `string`                              | `"/api/version"`              | Health probe path used after spawn.            |
| `startTimeoutMs`           | `number`                              | `15000`                       | Runtime health timeout.                        |
| `runtimePortEnvVar`        | `string`                              | `"BRIDGESOCKET_RUNTIME_PORT"` | Env var populated with allocated port.         |
| `eventHeartbeatIntervalMs` | `number`                              | `30000`                       | Ping interval for stale WS client cleanup.     |

Adapter-specific options:

| Option                | Type     | Default                        | Notes                                              |
| --------------------- | -------- | ------------------------------ | -------------------------------------------------- |
| `adapterName`         | `string` | `"bridgesocket-bridge"`        | Plugin/module name where applicable.               |
| `rewriteSource`       | `string` | `"/__bridgesocket/:path*"`     | Rewrite pattern used by Next wrapper.              |
| `nextBridgeGlobalKey` | `string` | auto-generated in Next wrapper | Override for deterministic Next standalone keying. |

## Bridge Routes

With default prefix `/__bridgesocket`:

- `GET /__bridgesocket/health`
- `GET /__bridgesocket/state`
- `GET /__bridgesocket/runtime/status`
- `POST /__bridgesocket/runtime/start`
- `POST /__bridgesocket/runtime/restart`
- `POST /__bridgesocket/runtime/stop`
- `WS /__bridgesocket/events`
- `ANY /__bridgesocket/api/*` (proxied to runtime as `/api/*`)

Notes:

- `GET /state` may auto-start runtime when `autoStart` is enabled.
- bridge routes are query-safe (for example `GET /__bridgesocket/state?source=ui`).
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

- supported: `bridgesocket.v1+json`
- if a client sends `Sec-WebSocket-Protocol`, the offered list must include `bridgesocket.v1+json`; otherwise the bridge rejects with `426`
- when accepted, the bridge negotiates `bridgesocket.v1+json`

Type source: `src/types.ts` (`BridgeSocketBridgeEvent`).

## Client API (`bridgesocket/client`)

```ts
import { createBridgeSocketClient } from "bridgesocket/client";

const client = createBridgeSocketClient({
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
import { withBridgeSocketNext } from "bridgesocket/next";

export default withBridgeSocketNext(
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
import { createBridgeSocketAstroIntegration } from "bridgesocket/astro";

export default defineConfig({
  integrations: [createBridgeSocketAstroIntegration()],
});
```

### Nuxt

```ts
// nuxt.config.ts
import { createBridgeSocketNuxtModule } from "bridgesocket/nuxt";
import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  modules: [createBridgeSocketNuxtModule()],
});
```

### Angular CLI (Proxy Config)

```ts
// bridgesocket.proxy.mjs
import { createBridgeSocketAngularCliProxyConfig } from "bridgesocket/angular/cli";
import { writeFile } from "node:fs/promises";

const proxyConfig = await createBridgeSocketAngularCliProxyConfig();
await writeFile(
  new URL("./proxy.bridgesocket.json", import.meta.url),
  JSON.stringify(proxyConfig, null, 2),
);
```

Then:

```bash
node bridgesocket.proxy.mjs
ng serve --proxy-config proxy.bridgesocket.json
```

### Bun.serve

```ts
import {
  attachBridgeSocketToBunServe,
  withBridgeSocketBunServeFetch,
  withBridgeSocketBunServeWebSocketHandlers,
} from "bridgesocket/bun";

const bridgesocket = await attachBridgeSocketToBunServe({
  command: "node",
  args: ["./scripts/dev-runtime.js"],
});

const server = Bun.serve({
  fetch: withBridgeSocketBunServeFetch(
    (request) => new Response(`route: ${new URL(request.url).pathname}`),
    bridgesocket,
  ),
  websocket: withBridgeSocketBunServeWebSocketHandlers(bridgesocket),
});

await bridgesocket.close();
server.stop();
```

### Node Server

```ts
import { attachBridgeSocketToNodeServer } from "bridgesocket/node";
import express from "express";
import http from "node:http";

const app = express();
const server = http.createServer(app);

await attachBridgeSocketToNodeServer(
  {
    middlewares: { use: app.use.bind(app) },
    httpServer: server,
  },
  { command: "node", args: ["./scripts/dev-runtime.js"] },
);
```

### Webpack Dev Server

```ts
import { withBridgeSocketWebpackDevServer } from "bridgesocket/webpack";

export default {
  devServer: withBridgeSocketWebpackDevServer({
    setupMiddlewares: (middlewares) => middlewares,
  }),
};
```

## Next.js Bridge Keys

`withBridgeSocketNext(nextConfig, options)` uses a standalone bridge behind rewrites in development.

Default behavior:

- each wrapper call gets a unique per-instance key
- this avoids collisions when multiple Next servers run in the same process

Optional override:

- set `nextBridgeGlobalKey` when you need deterministic keying or intentionally shared bridge state

```ts
import { withBridgeSocketNext } from "bridgesocket/next";

export default withBridgeSocketNext(
  { reactStrictMode: true },
  {
    nextBridgeGlobalKey: "__BRIDGESOCKET_NEXT_BRIDGE__:workspace-a",
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
- `INTEGRATION_GUIDE.md`: end-to-end example for building a CLI-style tool package and user project setup
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
