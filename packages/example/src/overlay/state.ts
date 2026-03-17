import {
  DEFAULT_SETTINGS,
  DEFAULT_TAB,
  OVERLAY_ENABLED_KEY,
  OVERLAY_POSITIONS,
  OVERLAY_STORAGE_KEY,
} from "./constants.js";
import type { OverlayAction, OverlaySettings, OverlayState } from "./types.js";

function mergeSettings(
  base: OverlaySettings,
  incoming: Partial<OverlaySettings> | null | undefined,
): OverlaySettings {
  const merged: OverlaySettings = {
    autoExpand: incoming?.autoExpand ?? base.autoExpand,
    theme: incoming?.theme ?? base.theme,
    position: incoming?.position ?? base.position,
    enabled: incoming?.enabled ?? base.enabled,
  };

  if (!OVERLAY_POSITIONS.includes(merged.position)) {
    merged.position = DEFAULT_SETTINGS.position;
  }

  if (
    merged.theme !== "light" &&
    merged.theme !== "dark" &&
    merged.theme !== "system"
  ) {
    merged.theme = DEFAULT_SETTINGS.theme;
  }

  return merged;
}

function parseSettingsFromStorage(): Partial<OverlaySettings> | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(OVERLAY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OverlaySettings>;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadOverlaySettings(): OverlaySettings {
  const fromStorage = parseSettingsFromStorage();

  // If no overlay theme has been saved yet, inherit from the page's "theme" key
  // so the overlay starts in sync with the page on first launch.
  let base = DEFAULT_SETTINGS;
  if (fromStorage?.theme == null && typeof window !== "undefined") {
    const pageTheme = localStorage.getItem("theme");
    if (pageTheme === "light" || pageTheme === "dark") {
      base = { ...DEFAULT_SETTINGS, theme: pageTheme };
    }
  }

  const settings = mergeSettings(base, fromStorage);

  if (typeof window !== "undefined") {
    const explicitEnabled = localStorage.getItem(OVERLAY_ENABLED_KEY);
    if (explicitEnabled === "true" || explicitEnabled === "false") {
      settings.enabled = explicitEnabled === "true";
    }
  }

  return settings;
}

export function persistOverlaySettings(settings: OverlaySettings): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore localStorage failures.
  }

  try {
    localStorage.setItem(
      OVERLAY_ENABLED_KEY,
      settings.enabled ? "true" : "false",
    );
  } catch {
    // Ignore localStorage failures.
  }
}

export function createInitialOverlayState(
  settings: OverlaySettings = DEFAULT_SETTINGS,
): OverlayState {
  return {
    connected: false,
    hasBootstrapped: false,
    transportState: "disconnected",
    activeTab: DEFAULT_TAB,
    expanded: false,
    loadingAction: null,
    errorMessage: null,
    lastSuccessAt: null,
    bridgeState: null,
    settings,
    fileTree: [],
    fileFilter: "",
    selectedFilePath: null,
    fileMetadata: null,
    fileMetadataLoading: false,
    treeLoading: false,
  };
}

export function overlayReducer(
  state: OverlayState,
  action: OverlayAction,
): OverlayState {
  switch (action.type) {
    case "bootstrapComplete":
      return { ...state, hasBootstrapped: true };
    case "setConnected":
      return { ...state, connected: action.connected };
    case "setTransportState":
      return { ...state, transportState: action.transportState };
    case "setBridgeState":
      return { ...state, bridgeState: action.bridgeState };
    case "setTab":
      return { ...state, activeTab: action.tab };
    case "setExpanded":
      return { ...state, expanded: action.expanded };
    case "setLoadingAction":
      return { ...state, loadingAction: action.loadingAction };
    case "setError":
      return {
        ...state,
        errorMessage: action.errorMessage,
        loadingAction: action.errorMessage ? null : state.loadingAction,
      };
    case "markSuccess":
      return {
        ...state,
        lastSuccessAt: action.at ?? Date.now(),
        errorMessage: null,
        loadingAction: null,
      };
    case "setSettings":
      return { ...state, settings: action.settings };
    case "setFileTree":
      return { ...state, fileTree: action.fileTree, treeLoading: false };
    case "setTreeLoading":
      return { ...state, treeLoading: action.treeLoading };
    case "setFileFilter":
      return { ...state, fileFilter: action.fileFilter };
    case "setSelectedFilePath":
      return {
        ...state,
        selectedFilePath: action.path,
        fileMetadata: action.path === null ? null : state.fileMetadata,
      };
    case "setFileMetadata":
      return {
        ...state,
        fileMetadata: action.metadata,
        fileMetadataLoading: false,
      };
    case "setFileMetadataLoading":
      return { ...state, fileMetadataLoading: action.loading };
    default:
      return state;
  }
}
