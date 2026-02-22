# DevSocket Bridge Protocol (v1)

This document is the normative source of truth for the DevSocket bridge protocol (v1).

## Document Meta

- Purpose: Define the normative bridge contract that clients and adapters must follow.
- Audience: Tool authors, adapter maintainers, client implementers.
- Status: Active
- Version: v1

## Versioning

- Protocol version: `1`
- Bridge state field: `protocolVersion: "1"`
- WebSocket subprotocol: `devsocket.v1+json`

Backward-incompatible protocol changes must increment this version.
Adding or updating adapter surfaces (framework, server, or build-tool) alone does not change protocol versioning.

## Route Prefix

Default bridge prefix: `/__devsocket`

All routes below are defined relative to that prefix.

## HTTP Routes

- `GET /health`
- `GET /state`
- `GET /runtime/status`
- `POST /runtime/start`
- `POST /runtime/restart`
- `POST /runtime/stop`
- `ANY /api/*` (proxied to runtime as `/api/*`)

### Query Handling

Route matching is pathname-based and query-safe.

Example:

- `GET /__devsocket/state?source=ui` is handled as `GET /state`.

## State Contract

`GET /state` returns `DevSocketBridgeState`.

```ts
interface DevSocketBridgeState {
  protocolVersion: "1";
  transportState:
    | "disconnected"
    | "bridge_detecting"
    | "runtime_starting"
    | "connected"
    | "degraded";
  runtime: DevSocketRuntimeStatus;
  capabilities: DevSocketBridgeCapabilities;
}
```

`capabilities` are configuration-aware:

- `hasRuntimeControl` and `can*Runtime` are `false` if runtime `command` is not configured.
- `commandHost` is `"helper"` when runtime command control is available, otherwise `"host"`.

## Runtime Lifecycle Semantics

- `autoStart` defaults to `true`.
- `GET /state` may auto-start runtime when `autoStart` is enabled.
- `POST /runtime/stop` disables auto-start until `start` or `restart` is called.
- `POST /runtime/stop` is idempotent and safe even when runtime command control is unavailable.

## WebSocket Events

Endpoint: `WS /events`

Subprotocol behavior:

- If `Sec-WebSocket-Protocol` is supplied, it must include `devsocket.v1+json`.
- Unsupported offered protocol list is rejected with `426`.

Event union:

- `runtime-status`
- `runtime-error`

All events include:

- `protocolVersion`
- `eventId` (monotonic per bridge instance)
- `timestamp` (milliseconds since epoch)

## Error Envelope

Bridge-generated non-2xx responses use:

```ts
{
  success: false;
  message: string;
  error: {
    code:
      | "invalid_request"
      | "route_not_found"
      | "runtime_start_failed"
      | "runtime_control_failed"
      | "runtime_unavailable"
      | "bridge_proxy_failed"
      | "internal_error";
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}
```

### Required Error Behaviors

- Missing runtime command on start/restart returns:
  - status `503`
  - `error.code = "runtime_start_failed"`
  - `error.details.reason = "missing_command"`
- Runtime unavailable proxy returns:
  - status `503`
  - `error.code = "runtime_unavailable"`

## Proxy Fidelity

`ANY /api/*` proxy guarantees:

- Binary request payload forwarding (no forced UTF-8 conversion).
- Multi-value `Set-Cookie` response header forwarding.
- Upstream 5xx responses emit `runtime-error` events.
- Upstream response status/body/headers are passed through (including non-2xx) and are not envelope-wrapped by default.
