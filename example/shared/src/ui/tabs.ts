import { cva } from "class-variance-authority";

import { cn } from "./utils";

export type TabsOrientation = "horizontal" | "vertical";
export type TabsVariant = "default" | "underline";

export interface TabsItem {
  id: string;
  label: string;
  panel: HTMLElement;
  disabled?: boolean;
}

export interface TabsOptions {
  className?: string;
  listClassName?: string;
  panelClassName?: string;
  orientation?: TabsOrientation;
  variant?: TabsVariant;
  value?: string;
  items?: TabsItem[];
  onChange?: (value: string) => void;
}

const tabsRootVariants = cva(
  "flex flex-col gap-2 data-[orientation=vertical]:flex-row",
);

const tabsListVariants = cva(
  "relative z-0 flex w-fit items-center justify-center text-muted-foreground data-[orientation=vertical]:flex-col",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "rounded-lg bg-muted p-0.5 text-muted-foreground/72 gap-0.5",
        underline:
          "data-[orientation=vertical]:px-1 data-[orientation=horizontal]:py-1 *:data-[slot=tabs-trigger]:hover:bg-accent",
      },
    },
  },
);

const tabsIndicatorVariants = cva(
  "absolute h-(--active-tab-height) w-(--active-tab-width) transition-[width,bottom,left,right] duration-200 ease-in-out ltr:left-(--active-tab-left) rtl:right-(--active-tab-right) bottom-(--active-tab-bottom)",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "-z-1 rounded-md bg-background shadow-sm dark:bg-accent",
        underline:
          "z-10 bg-primary data-[orientation=horizontal]:h-0.5 data-[orientation=vertical]:w-0.5",
      },
    },
  },
);

const tabsTriggerVariants = cva(
  "[&_svg]:-mx-0.5 flex shrink-0 grow cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-transparent font-medium text-base outline-none transition-[color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring data-disabled:pointer-events-none data-disabled:opacity-64 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 hover:text-muted-foreground data-active:text-foreground h-9 gap-1.5 px-[calc(--spacing(2.5)-1px)] sm:h-8 data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start",
);

const tabsPanelVariants = cva("flex-1 outline-none");

function createNode<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  return node;
}

export class Tabs {
  private root: HTMLDivElement;
  private list: HTMLDivElement;
  private panels: HTMLDivElement;
  private indicator: HTMLSpanElement;
  private items: TabsItem[] = [];
  private triggers = new Map<string, HTMLButtonElement>();
  private activeId: string | null;
  private onChange?: (value: string) => void;
  private orientation: TabsOrientation;
  private variant: TabsVariant;
  private resizeObserver: ResizeObserver;

  constructor(options: TabsOptions = {}) {
    this.onChange = options.onChange;
    this.orientation = options.orientation ?? "horizontal";
    this.variant = options.variant ?? "default";
    this.activeId = options.value ?? null;

    this.root = createNode("div", cn(tabsRootVariants(), options.className));
    this.root.setAttribute("data-slot", "tabs");
    this.root.setAttribute("data-orientation", this.orientation);

    this.list = createNode(
      "div",
      cn(tabsListVariants({ variant: this.variant }), options.listClassName),
    );
    this.list.setAttribute("data-slot", "tabs-list");
    this.list.setAttribute("data-variant", this.variant);
    this.list.setAttribute("role", "tablist");
    this.list.setAttribute("aria-orientation", this.orientation);

    this.indicator = createNode(
      "span",
      tabsIndicatorVariants({ variant: this.variant }),
    );
    this.indicator.setAttribute("data-slot", "tab-indicator");
    this.list.appendChild(this.indicator);

    this.panels = createNode(
      "div",
      cn(tabsPanelVariants(), options.panelClassName),
    );
    this.root.append(this.list, this.panels);

    this.resizeObserver = new ResizeObserver(() => this.updateIndicator(true));
    this.resizeObserver.observe(this.list);

    if (options.items) {
      this.setItems(options.items);
    }
  }

  private createTrigger(item: TabsItem): HTMLButtonElement {
    const trigger = createNode("button", tabsTriggerVariants());
    trigger.type = "button";
    trigger.textContent = item.label;
    trigger.setAttribute("role", "tab");
    trigger.setAttribute("data-slot", "tabs-trigger");
    trigger.setAttribute("data-orientation", this.orientation);
    trigger.setAttribute("data-value", item.id);
    trigger.setAttribute("aria-controls", `ui-tab-panel-${item.id}`);
    trigger.disabled = Boolean(item.disabled);

    trigger.addEventListener("click", () => {
      if (!item.disabled) {
        this.setValue(item.id, true);
      }
    });

    trigger.addEventListener("keydown", (event) => {
      const keyboardEvent = event as KeyboardEvent;
      const currentIndex = this.items.findIndex(
        (entry) => entry.id === item.id,
      );
      if (currentIndex < 0) return;

      const moveTo = (nextIndex: number) => {
        const normalized = (nextIndex + this.items.length) % this.items.length;
        const nextItem = this.items[normalized];
        if (!nextItem || nextItem.disabled) return;
        this.setValue(nextItem.id, true);
      };

      const isRTL = getComputedStyle(trigger).direction === "rtl";
      const [nextKey, prevKey] =
        this.orientation === "horizontal"
          ? isRTL
            ? ["ArrowLeft", "ArrowRight"]
            : ["ArrowRight", "ArrowLeft"]
          : ["ArrowDown", "ArrowUp"];

      if (keyboardEvent.key === nextKey) {
        keyboardEvent.preventDefault();
        moveTo(currentIndex + 1);
      } else if (keyboardEvent.key === prevKey) {
        keyboardEvent.preventDefault();
        moveTo(currentIndex - 1);
      } else if (keyboardEvent.key === "Home") {
        keyboardEvent.preventDefault();
        moveTo(0);
      } else if (keyboardEvent.key === "End") {
        keyboardEvent.preventDefault();
        moveTo(this.items.length - 1);
      }
    });

    return trigger;
  }

  private createPanel(item: TabsItem): HTMLElement {
    const shell = createNode("section", tabsPanelVariants());
    shell.id = `ui-tab-panel-${item.id}`;
    shell.setAttribute("role", "tabpanel");
    shell.setAttribute("data-slot", "tabs-content");
    shell.setAttribute("aria-labelledby", `ui-tab-trigger-${item.id}`);
    shell.appendChild(item.panel);
    return shell;
  }

  private updateIndicator(skipTransition = false): void {
    if (!this.activeId) {
      this.list.style.removeProperty("--active-tab-width");
      this.list.style.removeProperty("--active-tab-height");
      this.list.style.removeProperty("--active-tab-left");
      this.list.style.removeProperty("--active-tab-right");
      this.list.style.removeProperty("--active-tab-bottom");
      return;
    }

    const trigger = this.triggers.get(this.activeId);
    if (!trigger) return;

    if (skipTransition) {
      this.indicator.style.transition = "none";
      void this.indicator.offsetWidth;
    }

    const isRTL = getComputedStyle(this.list).direction === "rtl";
    const containerHeight = this.list.clientHeight;
    const triggerBottom =
      containerHeight - trigger.offsetTop - trigger.offsetHeight;

    this.list.style.setProperty(
      "--active-tab-width",
      `${trigger.offsetWidth}px`,
    );
    this.list.style.setProperty(
      "--active-tab-height",
      `${trigger.offsetHeight}px`,
    );
    this.list.style.setProperty("--active-tab-bottom", `${triggerBottom}px`);

    if (isRTL) {
      this.list.style.setProperty(
        "--active-tab-right",
        `${trigger.offsetLeft}px`,
      );
      this.list.style.removeProperty("--active-tab-left");
    } else {
      this.list.style.setProperty(
        "--active-tab-left",
        `${trigger.offsetLeft}px`,
      );
      this.list.style.removeProperty("--active-tab-right");
    }

    if (skipTransition) {
      requestAnimationFrame(() =>
        this.indicator.style.removeProperty("transition"),
      );
    }
  }

  private syncState(focus = false): void {
    this.items.forEach((item) => {
      const trigger = this.triggers.get(item.id);
      const panel = this.panels.querySelector<HTMLElement>(
        `#ui-tab-panel-${item.id}`,
      );
      if (!trigger || !panel) return;

      const active = this.activeId === item.id;
      trigger.dataset.active = active ? "true" : "false";
      trigger.id = `ui-tab-trigger-${item.id}`;
      trigger.setAttribute("aria-selected", active ? "true" : "false");
      trigger.tabIndex = active ? 0 : -1;
      if (focus && active) {
        trigger.focus();
      }

      panel.style.display = active ? "" : "none";
      panel.setAttribute("aria-hidden", active ? "false" : "true");
    });

    this.updateIndicator();
  }

  setItems(items: TabsItem[]): void {
    this.items = [...items];
    this.triggers.clear();
    this.list
      .querySelectorAll("[data-slot='tabs-trigger']")
      .forEach((node) => node.remove());
    this.panels.textContent = "";

    for (const item of items) {
      const trigger = this.createTrigger(item);
      this.triggers.set(item.id, trigger);
      this.list.appendChild(trigger);
      this.panels.appendChild(this.createPanel(item));
    }

    if (!this.activeId || !items.some((item) => item.id === this.activeId)) {
      this.activeId = items.find((item) => !item.disabled)?.id ?? null;
    }

    this.syncState();
  }

  getElement(): HTMLDivElement {
    return this.root;
  }

  getValue(): string | null {
    return this.activeId;
  }

  setValue(value: string, focus = false): void {
    if (!this.items.some((item) => item.id === value && !item.disabled)) return;
    if (this.activeId === value) return;
    this.activeId = value;
    this.syncState(focus);
    this.onChange?.(value);
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.root.remove();
  }
}
