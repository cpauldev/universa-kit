import {
  Fragment,
  createElement as createReactElement,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { type Root as ReactRoot, createRoot } from "react-dom/client";
import { Toaster, sileo } from "sileo";

import {
  OverlayPanel,
  type OverlayPanelProps,
  normalizeTheme,
} from "./OverlayPanel.js";
import {
  type DemoApi,
  type WebSocketBinding,
  createDemoApi,
  createWebSocketBinding,
  getDevServerBaseUrlCandidates,
  resolveDevServerBaseUrl,
} from "./api.js";
import {
  OVERLAY_HOST_ID,
  OVERLAY_MOUNT_ROOT_ATTRIBUTE,
  STATE_POLL_INTERVAL_MS,
  WS_RECONNECT_DELAY_MS,
} from "./constants.js";
import {
  createInitialOverlayState,
  loadOverlaySettings,
  overlayReducer,
  persistOverlaySettings,
} from "./state.js";
import type {
  OverlayAction,
  OverlayMountOptions,
  OverlaySettings,
  OverlayState,
} from "./types.js";

// ── Transport helpers ─────────────────────────────────────────────────────────

type TransportState = OverlayState["transportState"];
const FAILURE_THRESHOLD = 2;

function resolveBridgeTransportState(
  current: TransportState,
  bridgeState: import("bridgesocket").BridgeSocketBridgeState,
): TransportState {
  if (
    current === "runtime_starting" &&
    bridgeState.runtime.phase !== "running" &&
    bridgeState.runtime.phase !== "error"
  ) {
    return "runtime_starting";
  }
  return bridgeState.transportState;
}

function resolveFailureTransportState(
  current: TransportState,
  failures: number,
): TransportState {
  if (failures >= FAILURE_THRESHOLD) return "degraded";
  return current === "runtime_starting"
    ? "runtime_starting"
    : "bridge_detecting";
}

function shouldRetainConnectedState(
  connected: boolean,
  failures: number,
): boolean {
  return connected && failures < FAILURE_THRESHOLD;
}

// ─────────────────────────────────────────────────────────────────────────────

interface OverlayWindowConfig {
  __NUXT__?: unknown;
}

const OVERLAY_STYLE_ATTRIBUTE = "data-overlay-runtime-styles";
const OVERLAY_TOAST_ID = "demo-overlay";
let overlayStyleLoadPromise: Promise<void> | null = null;
let overlayStyleRefCount = 0;

function findOverlayRuntimeStylesheet(): HTMLLinkElement | null {
  return document.head.querySelector<HTMLLinkElement>(
    `link[${OVERLAY_STYLE_ATTRIBUTE}="true"]`,
  );
}

function ensureOverlayRuntimeStylesheet(): Promise<void> {
  const existing = findOverlayRuntimeStylesheet();
  if (existing?.sheet) return Promise.resolve();
  if (overlayStyleLoadPromise) return overlayStyleLoadPromise;

  const link =
    existing ??
    (() => {
      const nextLink = document.createElement("link");
      nextLink.rel = "stylesheet";
      nextLink.href = new URL("../overlay.css", import.meta.url).href;
      nextLink.setAttribute(OVERLAY_STYLE_ATTRIBUTE, "true");
      document.head.appendChild(nextLink);
      return nextLink;
    })();

  overlayStyleLoadPromise = new Promise<void>((resolve) => {
    const settle = () => {
      overlayStyleLoadPromise = null;
      resolve();
    };

    link.addEventListener("load", settle, { once: true });
    link.addEventListener("error", settle, { once: true });
  });

  return overlayStyleLoadPromise;
}

function retainOverlayRuntimeStylesheet(): Promise<void> {
  overlayStyleRefCount += 1;
  return ensureOverlayRuntimeStylesheet();
}

function releaseOverlayRuntimeStylesheet(): void {
  overlayStyleRefCount = Math.max(overlayStyleRefCount - 1, 0);
  if (overlayStyleRefCount > 0) return;

  findOverlayRuntimeStylesheet()?.remove();
  overlayStyleLoadPromise = null;
}

class OverlayPanelStore {
  #snapshot: OverlayPanelProps;
  #listeners = new Set<() => void>();

  constructor(initialSnapshot: OverlayPanelProps) {
    this.#snapshot = initialSnapshot;
  }

  getSnapshot = (): OverlayPanelProps => this.#snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  setSnapshot(nextSnapshot: OverlayPanelProps): void {
    this.#snapshot = nextSnapshot;
    for (const listener of this.#listeners) {
      listener();
    }
  }
}

function OverlayPanelDescription({ store }: { store: OverlayPanelStore }) {
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  return createReactElement(OverlayPanel, snapshot);
}

function OverlayToastController({
  autoExpand,
  store,
  theme,
}: {
  autoExpand: boolean;
  store: OverlayPanelStore;
  theme: "light" | "dark";
}) {
  const toastIdRef = useRef<string | null>(null);

  useEffect(() => {
    // CSS (data-theme on mount root → [data-sileo-pill]/[data-sileo-body] fill)
    // handles theme-driven blob colour changes after initial creation.
    if (toastIdRef.current) return;

    const fill = theme === "dark" ? "black" : "white";
    queueMicrotask(() => {
      if (toastIdRef.current) return;
      // Initial creation.
      toastIdRef.current = sileo.info({
        id: OVERLAY_TOAST_ID,
        title: "Demo",
        description: createReactElement(OverlayPanelDescription, {
          store,
        }),
        duration: null,
        autopilot: false,
        fill,
        // Always fixed — actual corner position is driven by data-overlay-position CSS
        position: "bottom-right",
      } as Parameters<typeof sileo.info>[0] & { id: string }) as string;
    });
  }, [store, theme]);

  useEffect(() => {
    return () => {
      if (toastIdRef.current) {
        sileo.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const root = document.getElementById(OVERLAY_HOST_ID);
    if (!root) return;

    let activeToast: HTMLElement | null = null;
    let activeHeader: HTMLElement | null = null;
    let isClickExpanded = false;
    let allowProgrammaticHover = false;

    const isWithinOverlayRoot = (target: Node | null) =>
      Boolean(target && root.contains(target));

    const triggerNativeOpen = (toast: HTMLElement | null) => {
      if (!toast) return;
      allowProgrammaticHover = true;
      toast.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      queueMicrotask(() => {
        allowProgrammaticHover = false;
      });
    };

    const triggerNativeClose = (toast: HTMLElement | null) => {
      toast?.dispatchEvent(
        new MouseEvent("mouseout", {
          bubbles: true,
          relatedTarget: document.body,
        }),
      );
    };

    const scheduleNativeClose = () => {
      if (!activeToast) return;
      triggerNativeClose(activeToast);
      queueMicrotask(() => {
        if (!activeToast || isClickExpanded) return;
        triggerNativeClose(activeToast);
      });
      requestAnimationFrame(() => {
        if (!activeToast || isClickExpanded) return;
        triggerNativeClose(activeToast);
      });
    };

    const reopenIfPinned = () => {
      if (!activeToast || !isClickExpanded) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!activeToast || !isClickExpanded) return;
          triggerNativeOpen(activeToast);
        });
      });
    };

    const bindToast = (toast: HTMLElement | null) => {
      if (activeToast === toast) return;

      if (activeHeader) {
        activeHeader.removeEventListener("click", handleHeaderClick);
      }

      if (activeToast) {
        activeToast.removeEventListener(
          "mouseover",
          handleToastMouseOverCapture,
          true,
        );
        activeToast.removeEventListener("focusin", handleFocusIn);
        activeToast.removeEventListener("focusout", handleFocusOut);
        activeToast.removeEventListener("mouseout", handleToastMouseOut);
        activeToast.removeEventListener("keydown", handleToastKeyDown);
      }

      activeToast = toast;
      activeHeader =
        toast?.querySelector<HTMLElement>("[data-sileo-header]") ?? null;
      isClickExpanded = false;
      if (!activeToast) return;

      activeToast.addEventListener(
        "mouseover",
        handleToastMouseOverCapture,
        true,
      );
      activeToast.addEventListener("focusin", handleFocusIn);
      activeToast.addEventListener("focusout", handleFocusOut);
      activeToast.addEventListener("mouseout", handleToastMouseOut);
      activeToast.addEventListener("keydown", handleToastKeyDown);
      activeHeader?.addEventListener("click", handleHeaderClick);

      if (!autoExpand) {
        requestAnimationFrame(() => {
          if (!activeToast || isClickExpanded) return;
          triggerNativeClose(activeToast);
        });
      }
    };

    const handleToastMouseOverCapture = (event: MouseEvent) => {
      if (autoExpand || allowProgrammaticHover) return;
      const target = event.target as Node | null;
      if (target && activeHeader?.contains(target)) {
        event.stopPropagation();
        return;
      }
      event.stopPropagation();
    };

    const handleFocusIn = () => {
      // Expand on hover only — focus alone does not expand.
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (!activeToast) return;
      // relatedTarget is null when focus goes to document.body, which happens
      // when the focused element is removed from the DOM (React re-renders a
      // tab change, a button becomes disabled, etc.).  This is transient — don't
      // collapse on it.  Only collapse when focus genuinely moves to an element
      // outside the overlay (keyboard Tab-away), where relatedTarget is set.
      if (!event.relatedTarget) return;
      requestAnimationFrame(() => {
        if (!activeToast) return;
        if (isWithinOverlayRoot(document.activeElement)) return;
        if (isClickExpanded || !autoExpand) return;
        triggerNativeClose(activeToast);
      });
    };

    const handleHeaderClick = (event: MouseEvent) => {
      if (!activeToast) return;
      event.preventDefault();
      event.stopPropagation();

      const isExpanded = activeToast.dataset.expanded === "true";
      if (!isExpanded || !isClickExpanded) {
        isClickExpanded = true;
        triggerNativeOpen(activeToast);
        return;
      }

      isClickExpanded = false;
      scheduleNativeClose();
    };

    const handleToastMouseOut = (event: MouseEvent) => {
      if (!activeToast || !isClickExpanded) return;
      const nextTarget = event.relatedTarget as Node | null;
      if (isWithinOverlayRoot(nextTarget)) return;
      reopenIfPinned();
    };

    const handleToastKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !activeToast || !isClickExpanded) return;
      event.preventDefault();
      event.stopPropagation();
      isClickExpanded = false;
      scheduleNativeClose();
      activeToast.focus();
    };

    const handleDocumentPointerDown = (event: PointerEvent) => {
      if (!activeToast || !isClickExpanded) return;
      const target = event.target as Node | null;
      if (isWithinOverlayRoot(target)) return;
      isClickExpanded = false;
      scheduleNativeClose();
    };

    const syncToast = () => {
      const toast = root.querySelector<HTMLElement>("[data-sileo-toast]");
      bindToast(toast);
    };

    syncToast();

    const observer = new MutationObserver(() => {
      syncToast();
    });

    document.addEventListener("pointerdown", handleDocumentPointerDown, true);

    observer.observe(root, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      document.removeEventListener(
        "pointerdown",
        handleDocumentPointerDown,
        true,
      );
      if (activeToast) {
        activeHeader?.removeEventListener("click", handleHeaderClick);
        activeToast.removeEventListener(
          "mouseover",
          handleToastMouseOverCapture,
          true,
        );
        activeToast.removeEventListener("focusin", handleFocusIn);
        activeToast.removeEventListener("focusout", handleFocusOut);
        activeToast.removeEventListener("mouseout", handleToastMouseOut);
        activeToast.removeEventListener("keydown", handleToastKeyDown);
      }
    };
  }, [autoExpand]);

  return null;
}

function OverlayRoot({
  autoExpand,
  store,
  theme,
}: {
  autoExpand: boolean;
  store: OverlayPanelStore;
  theme: "light" | "dark";
}) {
  return createReactElement(
    Fragment,
    null,
    // position is always fixed here; actual corner is driven by data-overlay-position CSS
    createReactElement(Toaster, { position: "bottom-right", theme }),
    createReactElement(OverlayToastController, {
      autoExpand,
      store,
      theme,
    }),
  );
}

export class DemoOverlay {
  #api: DemoApi;
  #baseUrl: string;
  #baseUrlCandidates: string[] = [];
  #baseUrlCandidateIndex = 0;
  #host: HTMLElement | null = null;
  #mountRoot: HTMLElement | null = null;
  #hostObserver: MutationObserver | null = null;
  #deferredMountCleanup: (() => void) | null = null;
  #mounted = false;
  #state: OverlayState;
  #wsBinding: WebSocketBinding | null = null;
  #wsConnectionVersion = 0;
  #wsConsecutiveFailures = 0;
  #wsConnected = false;
  #wsFallbackMode = false;
  #wsOpenedAt: number | null = null;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  #statePollTimer: ReturnType<typeof setInterval> | null = null;
  #allowWebSocket = true;
  #forceMount = false;
  #reactRoot: ReactRoot | null = null;
  #panelStore: OverlayPanelStore;
  #renderScheduled = false;
  #runtimeRefreshFailures = 0;
  #stylesReady = false;

  constructor(options: OverlayMountOptions = {}) {
    const settings = loadOverlaySettings();
    this.#state = createInitialOverlayState(settings);
    this.#baseUrlCandidates = getDevServerBaseUrlCandidates(options.baseUrl);
    this.#baseUrl =
      this.#baseUrlCandidates[0] || resolveDevServerBaseUrl(options.baseUrl);
    this.#api = createDemoApi(this.#baseUrl);
    this.#forceMount = Boolean(options.force);
    this.#allowWebSocket =
      typeof window === "undefined"
        ? true
        : !(window as Window & OverlayWindowConfig).__NUXT__;
    this.#panelStore = new OverlayPanelStore(this.buildPanelProps());

    if (this.#forceMount && !settings.enabled) {
      this.applySettings({ ...settings, enabled: true });
    }
  }

  mount(): void {
    if (this.#mounted) return;
    if (!this.#state.settings.enabled && !this.#forceMount) return;
    if (!document.body) {
      this.deferMountUntilBodyReady();
      return;
    }

    this.clearDeferredMount();

    document
      .querySelectorAll<HTMLElement>(`#${OVERLAY_HOST_ID}`)
      .forEach((node) => node.remove());

    this.#host = document.createElement("div");
    this.#host.id = OVERLAY_HOST_ID;
    document.body.appendChild(this.#host);
    this.startHostObserver();

    const mountRoot = document.createElement("div");
    mountRoot.setAttribute(OVERLAY_MOUNT_ROOT_ATTRIBUTE, "true");
    this.#host.appendChild(mountRoot);
    this.#mountRoot = mountRoot;
    this.#reactRoot = createRoot(mountRoot);

    this.#mounted = true;
    this.dispatch({ type: "setLoadingAction", loadingAction: "Connecting" });
    void this.finishMount();
  }

  destroy(): void {
    this.clearDeferredMount();
    this.clearReconnectTimer();

    this.stopStatePolling();
    this.closeWebSocket();
    this.stopHostObserver();

    this.#reactRoot?.unmount();
    this.#reactRoot = null;

    if (this.#host) {
      this.#host.remove();
      this.#host = null;
    }
    this.#mountRoot = null;

    if (this.#stylesReady) {
      releaseOverlayRuntimeStylesheet();
      this.#stylesReady = false;
    }

    this.#mounted = false;
  }

  private deferMountUntilBodyReady(): void {
    if (this.#deferredMountCleanup) return;

    const retryMount = () => {
      if (!document.body) return;
      this.clearDeferredMount();
      this.mount();
    };

    const onDOMContentLoaded = () => retryMount();
    const onLoad = () => retryMount();

    document.addEventListener("DOMContentLoaded", onDOMContentLoaded, {
      once: true,
    });
    window.addEventListener("load", onLoad, { once: true });

    this.#deferredMountCleanup = () => {
      document.removeEventListener("DOMContentLoaded", onDOMContentLoaded);
      window.removeEventListener("load", onLoad);
    };
  }

  private clearDeferredMount(): void {
    this.#deferredMountCleanup?.();
    this.#deferredMountCleanup = null;
  }

  private async finishMount(): Promise<void> {
    await retainOverlayRuntimeStylesheet();
    if (!this.#mounted) {
      releaseOverlayRuntimeStylesheet();
      return;
    }

    this.#stylesReady = true;
    this.render();
    await this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    await this.refreshState();
    if (this.#allowWebSocket) {
      this.connectWebSocket();
    } else {
      this.#wsConnected = false;
      this.#wsFallbackMode = true;
    }
    this.startStatePolling();
    this.dispatch({ type: "bootstrapComplete" });
    if (this.#state.activeTab === "files") {
      void this.ensureFileTreeLoaded();
    }
  }

  private dispatch(action: OverlayAction): void {
    const prevState = this.#state;
    this.#state = overlayReducer(this.#state, action);

    if (action.type === "setSettings") {
      persistOverlaySettings(action.settings);
    }

    if (this.#mounted) {
      this.applyUpdate(action, prevState);
    }
  }

  private applySettings(settings: OverlaySettings): void {
    this.dispatch({ type: "setSettings", settings });
  }

  private applyUpdate(action: OverlayAction, prevState: OverlayState): void {
    switch (action.type) {
      case "setSettings": {
        // Position changes: update CSS attribute only — no Sileo re-render needed
        // because the Sileo viewport position is always fixed at "bottom-right".
        if (
          action.settings.position !== prevState.settings.position &&
          this.#mountRoot
        ) {
          this.#mountRoot.dataset.overlayPosition = action.settings.position;
        }
        // Theme changes: re-render so OverlayToastController updates the fill colour.
        if (action.settings.theme !== prevState.settings.theme) {
          this.scheduleRender();
        } else {
          this.scheduleBodyUpdate();
        }
        break;
      }
      default:
        this.scheduleBodyUpdate();
        break;
    }
  }

  private scheduleRender(): void {
    if (this.#renderScheduled) return;
    this.#renderScheduled = true;
    queueMicrotask(() => {
      this.#renderScheduled = false;
      if (this.#mounted) this.render();
    });
  }

  private scheduleBodyUpdate(): void {
    if (this.#renderScheduled) return;
    queueMicrotask(() => {
      if (this.#mounted && !this.#renderScheduled) this.updatePanel();
    });
  }

  /** Re-render OverlayPanel into the existing sileo toast (no dismiss/re-show). */
  private updatePanel(): void {
    this.#panelStore.setSnapshot(this.buildPanelProps());
  }

  private buildPanelProps(): OverlayPanelProps {
    return {
      state: this.#state,
      wsConnected: this.#wsConnected,
      wsOpenedAt: this.#wsOpenedAt,
      wsFallbackMode: this.#wsFallbackMode,
      wsConsecutiveFailures: this.#wsConsecutiveFailures,
      onDispatch: this.dispatch.bind(this),
      onStart: () => void this.handleStart(),
      onStop: () => void this.handleStop(),
      onRestart: () => void this.handleRestart(),
      onLoadFileMetadata: (path) => void this.loadFileMetadata(path),
      onEnsureFileTreeLoaded: () => void this.ensureFileTreeLoaded(),
    };
  }

  // ── Runtime actions ────────────────────────────────────────────────────────

  private async runRuntimeAction(
    loadingLabel: string,
    fn: () => Promise<unknown>,
    fallbackMessage: string,
  ): Promise<void> {
    this.dispatch({ type: "setLoadingAction", loadingAction: loadingLabel });
    try {
      await fn();
      this.dispatch({ type: "markSuccess" });
      await this.refreshState();
    } catch (err) {
      const message = err instanceof Error ? err.message : fallbackMessage;
      this.dispatch({ type: "setError", errorMessage: message });
    }
  }

  private handleStart(): Promise<void> {
    return this.runRuntimeAction(
      "Starting",
      () => this.#api.startRuntime(),
      "Start failed",
    );
  }

  private handleRestart(): Promise<void> {
    return this.runRuntimeAction(
      "Restarting",
      () => this.#api.restartRuntime(),
      "Restart failed",
    );
  }

  private handleStop(): Promise<void> {
    return this.runRuntimeAction(
      "Stopping",
      () => this.#api.stopRuntime(),
      "Stop failed",
    );
  }

  // ── File tree ──────────────────────────────────────────────────────────────

  private async ensureFileTreeLoaded(): Promise<void> {
    if (this.#state.fileTree.length > 0) return;
    this.dispatch({ type: "setTreeLoading", treeLoading: true });
    try {
      const tree = await this.#api.getFileTree();
      this.dispatch({ type: "setFileTree", fileTree: tree });
    } catch {
      this.dispatch({ type: "setTreeLoading", treeLoading: false });
    }
  }

  private async loadFileMetadata(path: string): Promise<void> {
    this.dispatch({ type: "setFileMetadataLoading", loading: true });
    try {
      const meta = await this.#api.getFileMetadata(path);
      if (this.#state.selectedFilePath === path) {
        this.dispatch({ type: "setFileMetadata", metadata: meta });
      }
    } catch {
      this.dispatch({ type: "setFileMetadata", metadata: null });
    }
  }

  // ── State refresh ──────────────────────────────────────────────────────────

  private async refreshState(): Promise<void> {
    try {
      const bridgeState = await this.runWithBaseUrlFallback(
        () => this.#api.getBridgeState(),
        true,
      );

      const nextTransport = resolveBridgeTransportState(
        this.#state.transportState,
        bridgeState,
      );

      this.dispatch({ type: "setBridgeState", bridgeState });
      this.dispatch({
        type: "setTransportState",
        transportState: nextTransport,
      });
      this.dispatch({ type: "markSuccess" });

      const nextConnected = nextTransport === "connected";
      if (this.#state.connected !== nextConnected) {
        this.dispatch({ type: "setConnected", connected: nextConnected });
      }
      if (this.#state.loadingAction === "Connecting") {
        this.dispatch({ type: "setLoadingAction", loadingAction: null });
      }
      this.#runtimeRefreshFailures = 0;
    } catch {
      this.#runtimeRefreshFailures += 1;
      const nextTransport = resolveFailureTransportState(
        this.#state.transportState,
        this.#runtimeRefreshFailures,
      );
      const retainConnected = shouldRetainConnectedState(
        this.#state.connected,
        this.#runtimeRefreshFailures,
      );
      this.dispatch({
        type: "setTransportState",
        transportState: nextTransport,
      });
      if (!retainConnected && this.#state.connected) {
        this.dispatch({ type: "setConnected", connected: false });
      }
    }
  }

  // ── WebSocket ──────────────────────────────────────────────────────────────

  private connectWebSocket(): void {
    if (!this.#allowWebSocket) return;
    const connectionVersion = ++this.#wsConnectionVersion;
    this.#wsBinding?.close();
    this.#wsBinding = null;
    this.clearReconnectTimer();

    try {
      this.#wsBinding = createWebSocketBinding(this.#baseUrl, {
        onOpen: () => {
          if (connectionVersion !== this.#wsConnectionVersion) return;
          this.#wsConsecutiveFailures = 0;
          this.#wsConnected = true;
          this.#wsFallbackMode = false;
          this.#wsOpenedAt = Date.now();
          this.scheduleBodyUpdate();
        },
        onClose: () => {
          if (connectionVersion !== this.#wsConnectionVersion) return;
          this.#wsConnected = false;
          this.#wsConsecutiveFailures += 1;
          this.#wsFallbackMode = true;
          this.scheduleBodyUpdate();
          this.scheduleReconnect();
        },
        onError: () => {
          if (connectionVersion !== this.#wsConnectionVersion) return;
          this.#wsConnected = false;
          this.#wsFallbackMode = true;
          this.scheduleBodyUpdate();
          this.scheduleReconnect();
        },
        onMessage: (message) => {
          if (connectionVersion !== this.#wsConnectionVersion) return;
          const msg = message as { type?: string; data?: unknown };
          if (
            msg.type === "update" ||
            msg.type === "init" ||
            msg.type === "runtime-status" ||
            msg.type === "runtime-error"
          ) {
            void this.refreshState();
          }
        },
      });
    } catch {
      this.scheduleReconnect();
    }
  }

  private closeWebSocket(): void {
    this.#wsConnectionVersion += 1;
    this.#wsBinding?.close();
    this.#wsBinding = null;
    this.#wsConnected = false;
    this.#wsFallbackMode = true;
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      if (this.#mounted) this.connectWebSocket();
    }, WS_RECONNECT_DELAY_MS);
  }

  private clearReconnectTimer(): void {
    if (this.#reconnectTimer) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
  }

  // ── State polling ──────────────────────────────────────────────────────────

  private startStatePolling(): void {
    this.stopStatePolling();
    this.#statePollTimer = setInterval(() => {
      void this.refreshState();
    }, STATE_POLL_INTERVAL_MS);
  }

  private stopStatePolling(): void {
    if (this.#statePollTimer) {
      clearInterval(this.#statePollTimer);
      this.#statePollTimer = null;
    }
  }

  // ── Host observer (HMR cleanup) ────────────────────────────────────────────

  private startHostObserver(): void {
    if (!this.#host) return;
    this.stopHostObserver();
    this.#hostObserver = new MutationObserver(() => {
      if (this.#host && !document.body.contains(this.#host)) {
        this.destroy();
      }
    });
    this.#hostObserver.observe(document.body, {
      childList: true,
      subtree: false,
    });
  }

  private stopHostObserver(): void {
    if (this.#hostObserver) {
      this.#hostObserver.disconnect();
      this.#hostObserver = null;
    }
  }

  // ── Base URL fallback ──────────────────────────────────────────────────────

  private setActiveBaseUrl(baseUrl: string): void {
    if (this.#baseUrl === baseUrl) return;
    this.#baseUrl = baseUrl;
    this.#api = createDemoApi(this.#baseUrl);
  }

  private rotateBaseUrlCandidate(): void {
    if (this.#baseUrlCandidates.length < 2) return;
    this.#baseUrlCandidateIndex =
      (this.#baseUrlCandidateIndex + 1) % this.#baseUrlCandidates.length;
    this.setActiveBaseUrl(this.#baseUrlCandidates[this.#baseUrlCandidateIndex]);
  }

  private async runWithBaseUrlFallback<T>(
    task: () => Promise<T>,
    rotateBeforeRetry: boolean,
  ): Promise<T> {
    const totalCandidates = this.#baseUrlCandidates.length;
    if (totalCandidates <= 1) return task();

    try {
      return await task();
    } catch (firstErr) {
      for (let i = 1; i < totalCandidates; i += 1) {
        if (rotateBeforeRetry) this.rotateBaseUrlCandidate();
        try {
          return await task();
        } catch {
          // try next candidate
        }
      }
      throw firstErr;
    }
  }

  // ── Main render ────────────────────────────────────────────────────────────

  private render(): void {
    if (!this.#mounted) return;

    const theme = normalizeTheme(this.#state.settings.theme);
    const autoExpand = this.#state.settings.autoExpand;
    if (this.#mountRoot) {
      this.#mountRoot.dataset.theme = theme;
      this.#mountRoot.dataset.overlayPosition = this.#state.settings.position;
    }
    this.#panelStore.setSnapshot(this.buildPanelProps());

    this.#reactRoot?.render(
      createReactElement(OverlayRoot, {
        autoExpand,
        store: this.#panelStore,
        theme,
      }),
    );
  }
}
