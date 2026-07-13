import type { UniversalBridgeEvent, UniversalBridgeState } from "../types.js";
import { createUniversalClient, type UniversalClientOptions } from "./client.js";

export interface BridgeRuntimeSnapshot {
  bridgeState: UniversalBridgeState | null;
  connection: "idle" | "connecting" | "open" | "reconnecting" | "closed";
  action: "start" | "restart" | "stop" | null;
  error: string | null;
  eventId: number;
  revision: number;
  updatedAt: number | null;
}

export interface BridgeRuntimeStore {
  getSnapshot(): BridgeRuntimeSnapshot;
  subscribe(listener: () => void): () => void;
  start(): Promise<void>;
  restart(): Promise<void>;
  stop(): Promise<void>;
  refresh(): Promise<void>;
  destroy(): void;
}

const stores = new Map<string, BridgeRuntimeStore>();

function keyFor(options: UniversalClientOptions): string {
  const base = options.baseUrl ?? (typeof window === "undefined" ? "" : window.location.origin);
  return `${base.replace(/\/$/, "")}|${options.bridgePathPrefix ?? options.namespaceId ?? "__universal"}`;
}

export function createBridgeRuntimeStore(
  options: UniversalClientOptions = {},
): BridgeRuntimeStore {
  const key = keyFor(options);
  const existing = stores.get(key);
  if (existing) return existing;

  const client = createUniversalClient(options);
  const listeners = new Set<() => void>();
  let unsubscribeEvents: (() => void) | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshInFlight: Promise<void> | null = null;
  let snapshot: BridgeRuntimeSnapshot = {
    bridgeState: null, connection: "idle", action: null, error: null, eventId: 0, revision: 0, updatedAt: null,
  };
  const publish = (next: Partial<BridgeRuntimeSnapshot>) => {
    snapshot = { ...snapshot, ...next };
    for (const listener of listeners) listener();
  };
  const refresh = async () => {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = client.getState().then((bridgeState) => {
      if (bridgeState.revision < snapshot.revision) return;
      publish({ bridgeState, error: null, revision: bridgeState.revision, updatedAt: Date.now() });
    }).catch((error) => publish({ error: error instanceof Error ? error.message : String(error) }))
      .finally(() => { refreshInFlight = null; });
    return refreshInFlight;
  };
  const connect = () => {
    if (unsubscribeEvents || listeners.size === 0) return;
    publish({ connection: snapshot.connection === "idle" ? "connecting" : "reconnecting" });
    const markConnectionUnavailable = () => {
      publish({ connection: "reconnecting", bridgeState: null });
      reconnectTimer ??= setTimeout(() => { reconnectTimer = null; connect(); void refresh(); }, 1_500);
    };
    unsubscribeEvents = client.subscribeEvents((event: UniversalBridgeEvent) => {
      if (event.eventId <= snapshot.eventId) return;
      if (event.eventId > snapshot.eventId + 1 && snapshot.eventId !== 0) void refresh();
      if (event.type === "bridge-state") {
        if (event.state.revision >= snapshot.revision) {
          publish({ bridgeState: event.state, error: null, eventId: event.eventId, revision: event.state.revision, updatedAt: event.timestamp, connection: "open" });
        }
      } else {
        publish({ error: event.error, eventId: event.eventId, updatedAt: event.timestamp, connection: "open" });
      }
    }, { onOpen: () => publish({ connection: "open" }), onError: () => {
      unsubscribeEvents?.(); unsubscribeEvents = null;
      markConnectionUnavailable();
    }, onClose: () => {
      unsubscribeEvents = null;
      markConnectionUnavailable();
    }});
    void refresh();
  };
  const run = async (action: "start" | "restart" | "stop") => {
    publish({ action, error: null });
    try { await (action === "start" ? client.startRuntime() : action === "restart" ? client.restartRuntime() : client.stopRuntime()); }
    catch (error) { publish({ error: error instanceof Error ? error.message : String(error) }); }
    finally {
      publish({ action: null });
      // The action response is not itself state. Reconcile immediately when an
      // event was missed while a different tab performed the lifecycle change.
      void refresh();
    }
  };
  const store: BridgeRuntimeStore = {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); connect(); listener(); return () => { listeners.delete(listener); if (listeners.size === 0) { unsubscribeEvents?.(); unsubscribeEvents = null; publish({ connection: "idle" }); } }; },
    start: () => run("start"), restart: () => run("restart"), stop: () => run("stop"), refresh,
    destroy() { if (reconnectTimer) clearTimeout(reconnectTimer); unsubscribeEvents?.(); unsubscribeEvents = null; stores.delete(key); },
  };
  stores.set(key, store);
  return store;
}
