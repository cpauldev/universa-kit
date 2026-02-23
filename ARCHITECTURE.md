# BridgeSocket Architecture

## Document Meta

- Purpose: Explain the implementation structure and data flow of BridgeSocket components.
- Audience: Maintainers, contributors, and reviewers of BridgeSocket internals.
- Status: Active
- Version: aligned with protocol v1

## Overview

BridgeSocket is a framework-agnostic integration layer for in-browser development tools.
It provides a same-origin bridge (`/__bridgesocket/*`) mounted onto host development servers.

## Components

### 1. Adapters

- `src/adapters/framework/*` for framework-level integration (Next, Angular CLI proxy config, Astro, Nuxt).
- `src/adapters/server/*` for direct server integrations (Bun.serve, Node, Fastify, Hono).
- `src/adapters/build/*` for build-tool dev-server hooks (Webpack, Rsbuild, Rspack).

Adapters are responsible for attaching the bridge to the right middleware and HTTP upgrade surfaces.

### 2. Bridge

`src/bridge/*` is the protocol surface:

- `bridge.ts` orchestrator and composition root.
- `router.ts` request matching and route keying.
- `runtime-control.ts` state/runtime route handlers and auto-start policy.
- `proxy.ts` runtime API forwarding with body/header fidelity.
- `ws.ts` websocket upgrade validation and upstream runtime WS piping.
- `events.ts` event fanout, heartbeat, and ordered IDs.
- `errors.ts` standardized HTTP/upgrade error responses.

### 3. Runtime Helper

`src/runtime/runtime-helper.ts` manages optional runtime process lifecycle:

- command spawn
- health probing
- start/restart/stop
- runtime status tracking
- control capability detection (command configured vs missing)

### 4. Client API

`src/client/client.ts` provides a typed SDK for tool UIs:

- bridge state and health reads
- runtime lifecycle calls
- websocket event subscription
- typed error handling

## Data Flow

1. Host dev server starts.
2. Adapter attaches bridge middleware and upgrade handlers.
3. Browser tool UI calls bridge endpoints on same origin.
4. Bridge routes to runtime-control, proxy, or websocket modules.
5. Runtime helper starts/stops managed runtime when configured.
6. Event bus broadcasts runtime updates to subscribed UI clients.

## Reliability Guarantees

- Query-safe route matching.
- Configuration-aware capability reporting.
- Deterministic error envelope.
- Binary and multi-cookie proxy fidelity.
- WebSocket subprotocol validation (`bridgesocket.v1+json`).
- Singleton startup recovery for Next standalone bridge instances.
