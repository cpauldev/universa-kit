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
  description,
}: {
  toastId: string;
  title: string;
  theme: "light" | "dark";
  description: ReactElement;
}): void {
  const toastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (toastIdRef.current) return;
    const fill = theme === "dark" ? "black" : "white";
    queueMicrotask(() => {
      if (toastIdRef.current) return;
      toastIdRef.current = sileo.info({
        id: toastId,
        title,
        description,
        duration: null,
        autopilot: false,
        fill,
        position: "bottom-right",
      } as Parameters<typeof sileo.info>[0] & { id: string }) as string;
    });
  }, [description, theme, title, toastId]);

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
  autoExpand,
}: {
  shadowRoot: ShadowRoot;
  autoExpand: boolean;
}): void {
  useEffect(() => {
    let activeToast: HTMLElement | null = null;
    let activeHeader: HTMLElement | null = null;
    let isClickExpanded = false;
    let allowProgrammaticHover = false;

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
      if (autoExpand || allowProgrammaticHover) return;
      event.stopPropagation();
    };

    const handleFocusIn = () => {
      // Expand on hover only.
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (!activeToast) return;
      if (!event.relatedTarget) return;
      requestAnimationFrame(() => {
        if (!activeToast) return;
        if (shadowRoot.activeElement || isWithinRoot(document.activeElement)) {
          return;
        }
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

    const handleHeaderPointerDown = (event: PointerEvent) => {
      event.stopPropagation();
    };

    const handleHeaderPointerEnter = () => {
      if (!activeToast || !autoExpand || isClickExpanded) return;
      triggerNativeOpen(activeToast);
    };

    const handleToastPointerLeave = (event: PointerEvent) => {
      if (!activeToast || !autoExpand || isClickExpanded) return;
      const nextTarget = event.relatedTarget as Node | null;
      if (isWithinRoot(nextTarget)) return;
      scheduleNativeClose();
    };

    const handleToastMouseOut = (event: MouseEvent) => {
      if (!activeToast || !isClickExpanded) return;
      const nextTarget = event.relatedTarget as Node | null;
      if (isWithinRoot(nextTarget)) return;
      event.stopPropagation();
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
      const withinRoot = event
        .composedPath()
        .some((element) => isWithinRoot(element));
      if (withinRoot) return;
      isClickExpanded = false;
      scheduleNativeClose();
    };

    const bindToast = (toast: HTMLElement | null) => {
      if (activeToast === toast) return;

      activeHeader?.removeEventListener("pointerdown", handleHeaderPointerDown);
      activeHeader?.removeEventListener("click", handleHeaderClick);
      activeHeader?.removeEventListener(
        "pointerenter",
        handleHeaderPointerEnter,
      );

      if (activeToast) {
        activeToast.removeEventListener(
          "mouseover",
          handleToastMouseOverCapture,
          true,
        );
        activeToast.removeEventListener("focusin", handleFocusIn);
        activeToast.removeEventListener("focusout", handleFocusOut);
        activeToast.removeEventListener("mouseout", handleToastMouseOut);
        activeToast.removeEventListener(
          "pointerleave",
          handleToastPointerLeave,
        );
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
      activeToast.addEventListener("pointerleave", handleToastPointerLeave);
      activeToast.addEventListener("keydown", handleToastKeyDown);
      activeHeader?.addEventListener("pointerdown", handleHeaderPointerDown);
      activeHeader?.addEventListener("click", handleHeaderClick);
      activeHeader?.addEventListener("pointerenter", handleHeaderPointerEnter);

      if (!autoExpand) {
        requestAnimationFrame(() => {
          if (!activeToast || isClickExpanded) return;
          triggerNativeClose(activeToast);
        });
      }
    };

    const syncToast = () => {
      bindToast(shadowRoot.querySelector<HTMLElement>("[data-sileo-toast]"));
    };

    syncToast();

    const observer = new MutationObserver(syncToast);
    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    observer.observe(shadowRoot, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
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
        activeHeader?.removeEventListener(
          "pointerenter",
          handleHeaderPointerEnter,
        );
        activeToast.removeEventListener(
          "mouseover",
          handleToastMouseOverCapture,
          true,
        );
        activeToast.removeEventListener("focusin", handleFocusIn);
        activeToast.removeEventListener("focusout", handleFocusOut);
        activeToast.removeEventListener("mouseout", handleToastMouseOut);
        activeToast.removeEventListener(
          "pointerleave",
          handleToastPointerLeave,
        );
        activeToast.removeEventListener("keydown", handleToastKeyDown);
      }
    };
  }, [shadowRoot, autoExpand]);
}
