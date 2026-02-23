# BridgeSocket Integration Guide

This is a basic tool-author guide.

Goal:

1. Your package exposes one integration API (`acmetool`).
2. Your users add one config line and keep using normal `dev`.

The example tool below is `acmetool`.

## 1. Build a Runtime Command

Your tool should have a command BridgeSocket can start, usually `acmetool dev`.

```js
// runtime/dev-server.mjs
import { createServer } from "node:http";

const port = Number(process.env.ACMETOOL_RUNTIME_PORT ?? 3456);

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
  return;
}

if (command === "setup") {
  console.log("acmetool setup: write project config files here.");
  return;
}

console.log("Usage: acmetool <setup|dev>");
process.exit(1);
```

```json
// package.json
{
  "name": "acmetool",
  "type": "module",
  "bin": {
    "acmetool": "./bin/acmetool.mjs"
  }
}
```

## 2. Export a Preset from Your Package (Recommended)

This is the simplest integration shape for tool authors and users.

```ts
// src/index.ts
import { createBridgeSocketToolPreset } from "bridgesocket/preset";

export const acmetool = createBridgeSocketToolPreset({
  command: "acmetool",
  args: ["dev"],
  fallbackCommand: "acmetool dev",
});
```

```json
// package.json
{
  "exports": {
    ".": "./dist/index.js"
  }
}
```

With this shape, users always import from one place:

- `import { acmetool } from "acmetool"`

## 3. User Integration Example (Next.js)

```bash
npm i acmetool
```

```ts
// next.config.ts
import { acmetool } from "acmetool";

const nextConfig = {};

export default acmetool.next(nextConfig);
```

Then run normal app dev:

```bash
npm run dev
```

Bridge routes are mounted on same origin:

- `GET /__bridgesocket/health`
- `GET /__bridgesocket/state`
- `WS /__bridgesocket/events`
- `ANY /__bridgesocket/api/*`

## 4. User Integration Example (Vite)

```bash
npm i acmetool
```

```ts
// vite.config.ts
import { acmetool } from "acmetool";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [acmetool.vite()],
});
```

Then run:

```bash
npm run dev
```

## 5. Optional Browser Overlay Example (Shadow DOM)

This example mounts a minimal Shadow DOM overlay and wires runtime controls.

```ts
import { createBridgeSocketClient } from "bridgesocket/client";

const client = createBridgeSocketClient();

const host = document.createElement("div");
host.id = "acmetool-bridgesocket-overlay";
document.body.appendChild(host);

const shadow = host.attachShadow({ mode: "open" });
shadow.innerHTML = `
  <div>
    <strong>AcmeTool Overlay</strong>
    <div>Transport: <span data-transport>...</span></div>
    <div>Runtime: <span data-phase>...</span></div>
    <div>PID: <span data-pid>-</span></div>
    <div>URL: <span data-url>-</span></div>
    <div>Error: <span data-error>-</span></div>
    <button data-start>Start</button>
    <button data-restart>Restart</button>
    <button data-stop>Stop</button>
    <button data-refresh>Refresh</button>
  </div>
`;

const transportEl = shadow.querySelector("[data-transport]") as HTMLSpanElement;
const phaseEl = shadow.querySelector("[data-phase]") as HTMLSpanElement;
const pidEl = shadow.querySelector("[data-pid]") as HTMLSpanElement;
const urlEl = shadow.querySelector("[data-url]") as HTMLSpanElement;
const errorEl = shadow.querySelector("[data-error]") as HTMLSpanElement;

const startBtn = shadow.querySelector("[data-start]") as HTMLButtonElement;
const restartBtn = shadow.querySelector("[data-restart]") as HTMLButtonElement;
const stopBtn = shadow.querySelector("[data-stop]") as HTMLButtonElement;
const refreshBtn = shadow.querySelector("[data-refresh]") as HTMLButtonElement;

function renderState(state: Awaited<ReturnType<typeof client.getState>>) {
  transportEl.textContent = state.transportState;
  phaseEl.textContent = state.runtime.phase;
  pidEl.textContent =
    state.runtime.pid === null ? "-" : String(state.runtime.pid);
  urlEl.textContent = state.runtime.url ?? "-";
  errorEl.textContent = state.runtime.lastError ?? "-";
  startBtn.disabled = !state.capabilities.canStartRuntime;
  restartBtn.disabled = !state.capabilities.canRestartRuntime;
  stopBtn.disabled = !state.capabilities.canStopRuntime;
}

async function refresh() {
  const state = await client.getState();
  renderState(state);
}

startBtn.onclick = async () => {
  await client.startRuntime();
  await refresh();
};
restartBtn.onclick = async () => {
  await client.restartRuntime();
  await refresh();
};
stopBtn.onclick = async () => {
  await client.stopRuntime();
  await refresh();
};
refreshBtn.onclick = () => {
  void refresh();
};

const unsubscribe = client.subscribeEvents((event) => {
  if (event.type === "runtime-status") {
    phaseEl.textContent = event.status.phase;
    pidEl.textContent =
      event.status.pid === null ? "-" : String(event.status.pid);
    urlEl.textContent = event.status.url ?? "-";
    errorEl.textContent = event.status.lastError ?? "-";
  }
});

void refresh();
window.addEventListener("beforeunload", () => unsubscribe());
```

## 6. Optional: Framework-Specific Wrappers

If you prefer names like `withAcmeTool(...)` or `createAcmeToolVitePlugin(...)`, you can still wrap specific adapters. The preset export above is just the minimal default.

## 7. Notes

- If `command`/`args` are not configured, runtime `start` and `restart` are disabled by design.
- Keep your public API stable (`acmetool.next()`, `acmetool.vite()`, etc.).
- Most frameworks need one config change, but some ecosystems may require extra setup steps.
