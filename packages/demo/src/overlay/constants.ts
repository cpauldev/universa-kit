import type {
  OverlayPosition,
  OverlaySettings,
  TabDefinition,
} from "./types.js";

export const OVERLAY_HOST_ID = "overlay-host";
export const OVERLAY_MOUNT_ROOT_ATTRIBUTE = "data-overlay-root";
export const OVERLAY_MOUNT_ROOT_SELECTOR = `#${OVERLAY_HOST_ID} [${OVERLAY_MOUNT_ROOT_ATTRIBUTE}="true"]`;
export const OVERLAY_STORAGE_KEY = "demo:overlay:settings";
export const OVERLAY_DISABLE_KEY = "demo:overlay:disabled";
export const BRIDGE_BASE_PATH = "/__demo";

export const WS_RECONNECT_DELAY_MS = 1500;
export const STATE_POLL_INTERVAL_MS = 12000;

export const DEFAULT_SETTINGS: OverlaySettings = {
  autoExpand: true,
  theme: "light",
  position: "bottom-center",
  enabled: true,
};

export const OVERLAY_POSITIONS: OverlayPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

export const DEFAULT_TAB = "runtime" as const;

export const TABS: TabDefinition[] = [
  {
    id: "runtime",
    label: "Runtime",
    description: "Runtime status and controls",
    icon: "cpu",
  },
  {
    id: "files",
    label: "Files",
    description: "Browse project files and view metadata",
    icon: "folder-open",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Overlay appearance and behavior",
    icon: "sliders-horizontal",
  },
];
