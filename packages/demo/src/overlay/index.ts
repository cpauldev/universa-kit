import { OVERLAY_DISABLE_KEY } from "./constants.js";
import { DemoOverlay } from "./overlay.js";
import type { OverlayMountOptions } from "./types.js";

// ── Mount policy ─────────────────────────────────────────────────────────────

function isBrowserRuntime(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function isLikelyLocalHost(hostname: string): boolean {
  if (!hostname) return false;
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  )
    return true;
  if (hostname.endsWith(".local") || hostname.endsWith(".localhost"))
    return true;

  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;

  const [a, b] = ipv4.slice(1).map(Number);
  return (
    a === 10 ||
    a === 127 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31)
  );
}

function isDevLikeEnvironment(): boolean {
  if (!isBrowserRuntime()) return false;

  const env =
    typeof process !== "undefined" ? process.env?.NODE_ENV : undefined;
  if (env === "development" || env === "test") return true;
  if (env && env !== "development" && env !== "test") return false;

  if (isLikelyLocalHost(window.location.hostname)) return true;
  return window.location.search.includes("demoOverlay=1");
}

// ── Instance management ───────────────────────────────────────────────────────

interface OverlayInstanceLike {
  mount(): void;
  destroy(): void;
}

declare global {
  interface Window {
    __DEMO_OVERLAY_DISABLED__?: boolean;
    __DEMO_OVERLAY_ENABLED__?: boolean;
    __DEMO_OVERLAY_INSTANCE__?: OverlayInstanceLike | null;
  }
}

let overlayInstance: DemoOverlay | null = null;

function getGlobalOverlayInstance(): OverlayInstanceLike | null {
  if (!isBrowserRuntime()) return overlayInstance;
  const globalInstance = window.__DEMO_OVERLAY_INSTANCE__ ?? null;
  if (globalInstance && !overlayInstance)
    overlayInstance = globalInstance as DemoOverlay;
  return globalInstance;
}

function setGlobalOverlayInstance(instance: OverlayInstanceLike | null): void {
  if (isBrowserRuntime()) window.__DEMO_OVERLAY_INSTANCE__ = instance;
  overlayInstance = instance as DemoOverlay | null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function shouldMountOverlay(force = false): boolean {
  if (!isBrowserRuntime()) return false;
  if (force) return true;
  if (window.__DEMO_OVERLAY_DISABLED__) return false;
  if (window.__DEMO_OVERLAY_ENABLED__ === true) return true;

  try {
    if (localStorage.getItem(OVERLAY_DISABLE_KEY) === "true") return false;
  } catch {
    // Ignore localStorage failures.
  }

  return isDevLikeEnvironment();
}

export function mountOverlay(
  options: OverlayMountOptions = {},
): DemoOverlay | null {
  if (!shouldMountOverlay(options.force)) return null;

  const existing = getGlobalOverlayInstance();
  if (existing) {
    existing.mount();
    return existing as DemoOverlay;
  }

  const instance = new DemoOverlay({
    baseUrl: options.baseUrl,
    force: options.force,
  });
  instance.mount();
  setGlobalOverlayInstance(instance);
  return instance;
}

export function unmountOverlay(): void {
  getGlobalOverlayInstance()?.destroy();
  setGlobalOverlayInstance(null);
}

export { DemoOverlay };
export { createDemoApi } from "./api.js";
export type { DemoApi } from "./api.js";
export type { OverlayMountOptions };
export type {
  BridgeSocketBridgeState,
  BridgeSocketRuntimeStatus,
} from "./types.js";

// Auto-mount when imported as the adapter-injected overlay entry.
if (isBrowserRuntime() && shouldMountOverlay()) {
  try {
    mountOverlay();
  } catch {
    // Ignore overlay bootstrap failures.
  }
}
