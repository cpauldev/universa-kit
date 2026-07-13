import { createBridgeRuntimeStore, type BridgeRuntimeStore } from "universal-bridge";
import { BRIDGE_BASE_PATH } from "../overlay/constants.js";
import { createOverlayApi, resolveDevServerBaseUrl } from "../overlay/api.js";
import { createDashboardDiscoveryController, createInitialDiscoveryState } from "./discovery.js";
import { areDashboardLiveStatesEqual, createInitialDashboardLiveState, resolveDashboardLiveStateOnFailure, resolveDashboardLiveStateOnSuccess } from "./sections.js";
import type { DashboardActionId, DashboardController, DashboardControllerOptions, DashboardControllerState } from "./types.js";

function initialState(): DashboardControllerState {
  return { live: createInitialDashboardLiveState(), actionLoading: null, fileTree: [], treeLoading: false, fileFilter: "", selectedFilePath: null, fileMetadata: null, fileMetadataLoading: false, runtimeSnapshot: { bridgeState: null, connection: "idle", action: null, error: null, eventId: 0, revision: 0, updatedAt: null }, discovery: createInitialDiscoveryState() };
}

export function createDashboardController(options: DashboardControllerOptions = {}): DashboardController {
  const baseUrl = resolveDevServerBaseUrl(options.baseUrl);
  const api = createOverlayApi(baseUrl);
  const bridgeStore: BridgeRuntimeStore = createBridgeRuntimeStore({ baseUrl, bridgePathPrefix: BRIDGE_BASE_PATH });
  const listeners = new Set<(state: DashboardControllerState) => void>();
  const discovery = options.enableDiscovery ? createDashboardDiscoveryController(options.discovery ?? {}) : null;
  let state = initialState();
  let started = false;
  let storeUnsubscribe: (() => void) | null = null;
  let discoveryUnsubscribe: (() => void) | null = null;

  const setState = (next: DashboardControllerState) => {
    if (next === state) return;
    state = next;
    listeners.forEach((listener) => listener(state));
  };
  const applyStoreSnapshot = () => {
    const snapshot = bridgeStore.getSnapshot();
    const live = snapshot.bridgeState && snapshot.connection === "open"
      ? resolveDashboardLiveStateOnSuccess(state.live, snapshot.bridgeState)
      : resolveDashboardLiveStateOnFailure(
          state.live,
          new Error(snapshot.error ?? `Bridge connection is ${snapshot.connection}`),
        );
    if (areDashboardLiveStatesEqual(live, state.live) && snapshot === state.runtimeSnapshot) return;
    setState({ ...state, live, runtimeSnapshot: snapshot });
  };
  const runAction = async (action: DashboardActionId) => {
    setState({ ...state, actionLoading: action });
    try { await (action === "start" ? bridgeStore.start() : action === "restart" ? bridgeStore.restart() : bridgeStore.stop()); }
    finally { setState({ ...state, actionLoading: null }); }
  };
  const loadFileTree = async () => {
    if (state.treeLoading || state.fileTree.length) return;
    setState({ ...state, treeLoading: true });
    try { setState({ ...state, fileTree: await api.getFileTree(), treeLoading: false }); }
    catch { setState({ ...state, treeLoading: false }); }
  };
  const selectFilePath = async (path: string | null) => {
    setState({ ...state, selectedFilePath: path, fileMetadata: path ? state.fileMetadata : null, fileMetadataLoading: Boolean(path) });
    if (!path) return;
    try { const fileMetadata = await api.getFileMetadata(path); if (state.selectedFilePath === path) setState({ ...state, fileMetadata, fileMetadataLoading: false }); }
    catch { if (state.selectedFilePath === path) setState({ ...state, fileMetadata: null, fileMetadataLoading: false }); }
  };
  return {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); listener(state); return () => listeners.delete(listener); },
    start() {
      if (started) return; started = true;
      storeUnsubscribe = bridgeStore.subscribe(applyStoreSnapshot); applyStoreSnapshot();
      if (discovery) { discoveryUnsubscribe = discovery.subscribe((discoveryState) => setState({ ...state, discovery: discoveryState })); discovery.start(); }
      if (options.loadFilesOnStart) void loadFileTree();
    },
    stop() { if (!started) return; started = false; storeUnsubscribe?.(); storeUnsubscribe = null; discovery?.stop(); discoveryUnsubscribe?.(); discoveryUnsubscribe = null; },
    runAction,
    setFileFilter(value) { if (value !== state.fileFilter) setState({ ...state, fileFilter: value }); },
    selectFilePath,
    loadFileTree,
  };
}
