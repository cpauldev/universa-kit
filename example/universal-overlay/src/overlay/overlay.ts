import {
  createElement as createReactElement,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { type Root as ReactRoot, createRoot } from "react-dom/client";
import { Toaster } from "sileo";
import { createBridgeRuntimeStore, type BridgeRuntimeSnapshot, type BridgeRuntimeStore } from "universal-bridge";

import {
  OverlayPanel,
  type OverlayPanelProps,
  BridgeStatusIcon,
  normalizeTheme,
  resolveOverlaySeverity,
} from "./OverlayPanel.js";
import {
  type OverlayApi,
  createOverlayApi,
  resolveDevServerBaseUrl,
} from "./api.js";
import {
  OVERLAY_HOST_ID,
  OVERLAY_MOUNT_ROOT_ATTRIBUTE,
  BRIDGE_BASE_PATH,
} from "./constants.js";
import {
  PanelStore,
  ShadowStyleSheet,
  useToast,
  useToastController,
} from "./shared/shadow.js";
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
import { setOverlayPortalContainer } from "./ui/utils.js";

const OVERLAY_TOAST_ID = "universal-overlay";
const __OVERLAY_CSS_INLINE__ = "__UNIVERSAL_OVERLAY_CSS_INLINE__";
const overlayStyles = new ShadowStyleSheet();

function OverlayPanelDescription({
  store,
}: {
  store: PanelStore<OverlayPanelProps>;
}) {
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  return createReactElement(OverlayPanel, snapshot);
}

function BridgeStateIcon({ store }: { store: PanelStore<OverlayPanelProps> }) {
  const { state } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const status = resolveOverlaySeverity(state);
  const iconRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const toast = iconRef.current?.closest<HTMLElement>("[data-sileo-toast]");
    if (!toast) return;
    toast.dataset.state = status;
    toast
      .querySelectorAll<HTMLElement>("[data-sileo-badge], [data-sileo-title]")
      .forEach((element) => {
        element.dataset.state = status;
      });
  }, [status]);

  return createReactElement(
    "span",
    { ref: iconRef },
    createReactElement(BridgeStatusIcon, {
      severity: status,
      phase: state.bridgeState?.runtime.phase,
      className: "size-4",
    }),
  );
}

function OverlayRoot({
  store,
  theme,
  shadowRoot,
}: {
  store: PanelStore<OverlayPanelProps>;
  theme: "light" | "dark";
  shadowRoot: ShadowRoot;
}) {
  useToast({
    toastId: OVERLAY_TOAST_ID,
    title: "Universal Overlay",
    theme,
    icon: createReactElement(BridgeStateIcon, { store }),
    description: createReactElement(OverlayPanelDescription, {
      store,
    }),
  });
  useToastController({ shadowRoot });

  return createReactElement(Toaster, {
    position: "bottom-right",
    theme,
  });
}

export class UniversalOverlay {
  #api: OverlayApi;
  #bridgeStore: BridgeRuntimeStore;
  #bridgeStoreUnsubscribe: (() => void) | null = null;
  #host: HTMLElement | null = null;
  #shadowRoot: ShadowRoot | null = null;
  #mountRoot: HTMLElement | null = null;
  #hostObserver: MutationObserver | null = null;
  #deferredMountCleanup: (() => void) | null = null;
  #mounted = false;
  #state: OverlayState;
  #runtimeSnapshot: BridgeRuntimeSnapshot = { bridgeState: null, connection: "idle", action: null, error: null, eventId: 0, revision: 0, updatedAt: null };
  #forceMount = false;
  #reactRoot: ReactRoot | null = null;
  #panelStore: PanelStore<OverlayPanelProps>;
  #renderScheduled = false;
  #stylesReady = false;

  constructor(options: OverlayMountOptions = {}) {
    const settings = loadOverlaySettings();
    this.#state = createInitialOverlayState(settings);
    const baseUrl = resolveDevServerBaseUrl(options.baseUrl);
    this.#api = createOverlayApi(baseUrl);
    this.#bridgeStore = createBridgeRuntimeStore({ baseUrl, bridgePathPrefix: BRIDGE_BASE_PATH });
    this.#forceMount = Boolean(options.force);
    this.#panelStore = new PanelStore(this.buildPanelProps());

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
    this.#shadowRoot = this.#host.attachShadow({ mode: "open" });
    this.startHostObserver();

    const mountRoot = document.createElement("div");
    mountRoot.setAttribute(OVERLAY_MOUNT_ROOT_ATTRIBUTE, "true");
    this.#shadowRoot.appendChild(mountRoot);
    this.#mountRoot = mountRoot;
    setOverlayPortalContainer(mountRoot);
    this.#reactRoot = createRoot(mountRoot);

    this.#mounted = true;
    this.dispatch({ type: "setLoadingAction", loadingAction: "Connecting" });
    this.#bridgeStoreUnsubscribe = this.#bridgeStore.subscribe(() => {
      const snapshot = this.#bridgeStore.getSnapshot();
      this.#runtimeSnapshot = snapshot;
      if (snapshot.bridgeState && snapshot.connection === "open") {
        this.dispatch({ type: "setBridgeState", bridgeState: snapshot.bridgeState });
        this.dispatch({ type: "setTransportState", transportState: snapshot.bridgeState.transportState });
        this.dispatch({ type: "setConnected", connected: snapshot.bridgeState.transportState === "connected" });
        this.dispatch({ type: "markSuccess", at: snapshot.updatedAt ?? undefined });
      } else {
        this.dispatch({ type: "setBridgeState", bridgeState: null });
        this.dispatch({ type: "setTransportState", transportState: "degraded" });
        this.dispatch({ type: "setConnected", connected: false });
        this.dispatch({ type: "setError", errorMessage: snapshot.error ?? `Bridge connection is ${snapshot.connection}` });
      }
    });
    void this.finishMount();
  }

  destroy(): void {
    this.clearDeferredMount();
    this.#bridgeStoreUnsubscribe?.();
    this.#bridgeStoreUnsubscribe = null;
    this.stopHostObserver();

    this.#reactRoot?.unmount();
    this.#reactRoot = null;
    setOverlayPortalContainer(null);

    if (this.#host) {
      this.#host.remove();
      this.#host = null;
    }
    this.#mountRoot = null;

    if (this.#stylesReady && this.#shadowRoot) {
      overlayStyles.release(this.#shadowRoot);
      this.#stylesReady = false;
    }
    this.#shadowRoot = null;

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

    // If DOMContentLoaded already fired (readyState is not 'loading'), the
    // event listeners above will never trigger. Kick off a rAF-based retry so
    // the mount still happens on the next animation frame.
    if (document.readyState !== "loading") {
      requestAnimationFrame(() => retryMount());
    }
  }

  private clearDeferredMount(): void {
    this.#deferredMountCleanup?.();
    this.#deferredMountCleanup = null;
  }

  private async finishMount(): Promise<void> {
    if (this.#shadowRoot) {
      overlayStyles.retain(this.#shadowRoot, __OVERLAY_CSS_INLINE__);
    }
    if (!this.#mounted) {
      if (this.#shadowRoot) {
        overlayStyles.release(this.#shadowRoot);
      }
      return;
    }

    this.#stylesReady = true;
    this.render();
    await this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
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
        // Theme changes need a full render so mount-root data-theme is refreshed.
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
      runtimeSnapshot: this.#runtimeSnapshot,
      onDispatch: this.dispatch.bind(this),
      onStart: () => void this.handleStart(),
      onStop: () => void this.handleStop(),
      onRestart: () => void this.handleRestart(),
      onLoadFileMetadata: (path) => void this.loadFileMetadata(path),
      onOpenFile: (path) => void this.openFile(path),
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
    } catch (err) {
      const message = err instanceof Error ? err.message : fallbackMessage;
      this.dispatch({ type: "setError", errorMessage: message });
    }
  }

  private handleStart(): Promise<void> {
    return this.runRuntimeAction(
      "Starting",
      () => this.#bridgeStore.start(),
      "Start failed",
    );
  }

  private handleRestart(): Promise<void> {
    return this.runRuntimeAction(
      "Restarting",
      () => this.#bridgeStore.restart(),
      "Restart failed",
    );
  }

  private handleStop(): Promise<void> {
    return this.runRuntimeAction(
      "Stopping",
      () => this.#bridgeStore.stop(),
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

  private async openFile(path: string): Promise<void> {
    try {
      await this.#api.openFile(path);
    } catch {
      // Best-effort: opening files in editor is non-critical.
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

  // ── Main render ────────────────────────────────────────────────────────────

  private render(): void {
    if (!this.#mounted || !this.#shadowRoot) return;

    const theme = normalizeTheme(this.#state.settings.theme);
    if (this.#mountRoot) {
      this.#mountRoot.dataset.theme = theme;
      this.#mountRoot.dataset.overlayPosition = this.#state.settings.position;
    }
    this.#panelStore.setSnapshot(this.buildPanelProps());

    this.#reactRoot?.render(
      createReactElement(OverlayRoot, {
        store: this.#panelStore,
        theme,
        shadowRoot: this.#shadowRoot,
      }),
    );
  }
}
