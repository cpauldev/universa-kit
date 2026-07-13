import { type ReactElement, useEffect, useRef } from "react";
import { sileo } from "sileo";

export function removeSileoHeadStyles(): void {
  if (typeof document === "undefined") return;
  for (const style of Array.from(
    document.head.querySelectorAll<HTMLStyleElement>("style"),
  )) {
    // sileo __insertCSS() uses an attribute-less style tag.
    const hasDataAttr = Array.from(style.attributes).some((attribute) =>
      attribute.name.startsWith("data-"),
    );
    if (!hasDataAttr && style.textContent?.includes("--sileo-spring-easing")) {
      style.remove();
    }
  }
}

export class ShadowStyleSheet {
  #sheet: CSSStyleSheet | null = null;
  #refCount = 0;

  retain(shadowRoot: ShadowRoot, cssInline: string): void {
    this.#refCount += 1;
    if (!this.#sheet) {
      this.#sheet = new CSSStyleSheet();
      this.#sheet.replaceSync(cssInline);
    }

    if (!shadowRoot.adoptedStyleSheets.includes(this.#sheet)) {
      shadowRoot.adoptedStyleSheets = [
        ...shadowRoot.adoptedStyleSheets,
        this.#sheet,
      ];
    }
    removeSileoHeadStyles();
  }

  release(shadowRoot: ShadowRoot): void {
    this.#refCount = Math.max(this.#refCount - 1, 0);
    shadowRoot.adoptedStyleSheets = shadowRoot.adoptedStyleSheets.filter(
      (sheet) => sheet !== this.#sheet,
    );
    if (this.#refCount === 0) this.#sheet = null;
  }
}

export class PanelStore<T> {
  #snapshot: T;
  #listeners = new Set<() => void>();

  constructor(initialSnapshot: T) {
    this.#snapshot = initialSnapshot;
  }

  getSnapshot = (): T => this.#snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  setSnapshot(nextSnapshot: T): void {
    this.#snapshot = nextSnapshot;
    for (const listener of this.#listeners) listener();
  }
}

export function useToast({
  toastId,
  title,
  theme,
  icon,
  description,
}: {
  toastId: string;
  title: string;
  theme: "light" | "dark";
  icon: ReactElement;
  description: ReactElement;
}): void {
  const toastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (toastIdRef.current) return;
    const fill = theme === "dark" ? "black" : "white";
    queueMicrotask(() => {
      if (toastIdRef.current) return;
      const options = {
        id: toastId,
        title,
        icon,
        description,
        duration: null,
        autopilot: false,
        fill,
        position: "bottom-right",
      } as Parameters<typeof sileo.info>[0] & { id: string };
      toastIdRef.current = sileo.info(options) as string;
    });
  }, [theme, title, toastId]);

  useEffect(() => {
    return () => {
      if (toastIdRef.current) {
        sileo.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    };
  }, []);
}

export function useToastController({
  shadowRoot,
}: {
  shadowRoot: ShadowRoot;
}): void {
  useEffect(() => {
    let activeToast: HTMLElement | null = null;
    let activeHeader: HTMLElement | null = null;
    let isClickExpanded = false;
    let allowProgrammaticHover = false;
    let keepOpenTimer: ReturnType<typeof setInterval> | null = null;

    const isNode = (value: unknown): value is Node =>
      typeof Node !== "undefined" && value instanceof Node;

    const isWithinRoot = (target: unknown) =>
      Boolean(isNode(target) && shadowRoot.contains(target));

    const triggerNativeOpen = (toast: HTMLElement | null) => {
      if (!toast) return;
      allowProgrammaticHover = true;
      toast.dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true, composed: true }),
      );
      queueMicrotask(() => {
        allowProgrammaticHover = false;
      });
    };

    const retainNativeOpen = () => {
      if (!activeToast) return;
      triggerNativeOpen(activeToast);
      if (keepOpenTimer) return;
      keepOpenTimer = setInterval(() => {
        triggerNativeOpen(activeToast);
      }, 150);
    };

    const releaseNativeOpen = () => {
      if (!keepOpenTimer) return;
      clearInterval(keepOpenTimer);
      keepOpenTimer = null;
    };

    const triggerNativeClose = (toast: HTMLElement | null) => {
      toast?.dispatchEvent(
        new MouseEvent("mouseout", {
          bubbles: true,
          composed: true,
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

    const handleToastMouseOverCapture = (event: MouseEvent) => {
      if (allowProgrammaticHover) return;
      event.stopPropagation();
    };

    const handleHeaderClick = (event: MouseEvent) => {
      if (!activeToast) return;
      event.preventDefault();
      event.stopPropagation();
      const isExpanded = activeToast.dataset.expanded === "true";
      if (!isExpanded || !isClickExpanded) {
        isClickExpanded = true;
        retainNativeOpen();
        return;
      }
      isClickExpanded = false;
      releaseNativeOpen();
      scheduleNativeClose();
    };

    const handleHeaderPointerDown = (event: PointerEvent) => {
      event.stopPropagation();
    };

    const handleToastMouseOut = (event: MouseEvent) => {
      if (!activeToast || !isClickExpanded) return;
      const nextTarget = event.relatedTarget as Node | null;
      if (isWithinRoot(nextTarget)) return;
      event.stopPropagation();
    };

    const handleShadowMouseOutCapture = (event: Event) => {
      if (!activeToast || !isClickExpanded) return;
      if (!event.composedPath().includes(activeToast)) return;
      event.stopPropagation();
    };

    const handleToastKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !activeToast || !isClickExpanded) return;
      event.preventDefault();
      event.stopPropagation();
      isClickExpanded = false;
      releaseNativeOpen();
      scheduleNativeClose();
      activeToast.focus();
    };

    const handleDocumentPointerDown = (event: PointerEvent) => {
      if (!activeToast || !isClickExpanded) return;
      const withinRoot = event
        .composedPath()
        .some((element) => isWithinRoot(element));
      if (withinRoot) return;
      isClickExpanded = false;
      releaseNativeOpen();
      scheduleNativeClose();
    };

    const bindToast = (toast: HTMLElement | null) => {
      if (activeToast === toast) return;

      activeHeader?.removeEventListener("pointerdown", handleHeaderPointerDown);
      activeHeader?.removeEventListener("click", handleHeaderClick);
      if (activeToast) {
        activeToast.removeEventListener(
          "mouseover",
          handleToastMouseOverCapture,
          true,
        );
        activeToast.removeEventListener("mouseout", handleToastMouseOut, true);
        activeToast.removeEventListener("keydown", handleToastKeyDown);
      }
      releaseNativeOpen();

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
      activeToast.addEventListener("mouseout", handleToastMouseOut, true);
      activeToast.addEventListener("keydown", handleToastKeyDown);
      activeHeader?.addEventListener("pointerdown", handleHeaderPointerDown);
      activeHeader?.addEventListener("click", handleHeaderClick);

      requestAnimationFrame(() => {
        if (!activeToast || isClickExpanded) return;
        triggerNativeClose(activeToast);
      });
    };

    const syncToast = () => {
      bindToast(shadowRoot.querySelector<HTMLElement>("[data-sileo-toast]"));
    };

    syncToast();

    const observer = new MutationObserver(syncToast);
    shadowRoot.addEventListener("mouseout", handleShadowMouseOutCapture, true);
    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    observer.observe(shadowRoot, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      shadowRoot.removeEventListener(
        "mouseout",
        handleShadowMouseOutCapture,
        true,
      );
      document.removeEventListener(
        "pointerdown",
        handleDocumentPointerDown,
        true,
      );
      if (activeToast) {
        activeHeader?.removeEventListener(
          "pointerdown",
          handleHeaderPointerDown,
        );
        activeHeader?.removeEventListener("click", handleHeaderClick);
        activeToast.removeEventListener(
          "mouseover",
          handleToastMouseOverCapture,
          true,
        );
        activeToast.removeEventListener("mouseout", handleToastMouseOut, true);
        activeToast.removeEventListener("keydown", handleToastKeyDown);
      }
    };
  }, [shadowRoot]);
}
