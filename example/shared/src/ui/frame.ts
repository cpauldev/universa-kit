import { cva } from "class-variance-authority";

import { createElement } from "./dom";
import { cn } from "./utils";

export interface FrameOptions {
  className?: string;
  stackedPanels?: boolean;
}

export const frameVariants = cva("relative flex flex-col rounded-2xl p-1", {
  variants: {
    stackedPanels: {
      false: "*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-1",
      true: "*:has-[+[data-slot=frame-panel]]:rounded-b-none *:has-[+[data-slot=frame-panel]]:before:hidden dark:*:has-[+[data-slot=frame-panel]]:before:block *:[[data-slot=frame-panel]+[data-slot=frame-panel]]:rounded-t-none *:[[data-slot=frame-panel]+[data-slot=frame-panel]]:border-t-0 dark:*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:before:hidden",
    },
  },
  defaultVariants: {
    stackedPanels: false,
  },
});

export const framePanelVariants = cva(
  "relative rounded-xl border bg-background bg-clip-padding p-5 shadow-xs before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:bg-clip-border dark:before:shadow-[0_-1px_--theme(--color-white/8%)]",
);

export const frameHeaderVariants = cva("flex flex-col px-5 py-4");

export const frameTitleVariants = cva("font-semibold text-sm");

export const frameDescriptionVariants = cva("text-muted-foreground text-sm");

export const frameFooterVariants = cva("flex flex-col gap-1 px-5 py-4");

export function createFrame(options: FrameOptions = {}): HTMLDivElement {
  return createElement("div", {
    className: cn(
      frameVariants({ stackedPanels: Boolean(options.stackedPanels) }),
      options.className,
    ),
    attributes: {
      "data-slot": "frame",
      ...(options.stackedPanels ? { "data-stacked-panels": "true" } : {}),
    },
  }) as HTMLDivElement;
}

export function createFramePanel(className = ""): HTMLDivElement {
  return createElement("div", {
    className: cn(framePanelVariants(), className),
    attributes: { "data-slot": "frame-panel" },
  }) as HTMLDivElement;
}

export function createFrameHeader(className = ""): HTMLElement {
  return createElement("header", {
    className: cn(frameHeaderVariants(), className),
    attributes: { "data-slot": "frame-panel-header" },
  });
}

export function createFrameTitle(text: string, className = ""): HTMLDivElement {
  return createElement("div", {
    className: cn(frameTitleVariants(), className),
    textContent: text,
    attributes: { "data-slot": "frame-panel-title" },
  }) as HTMLDivElement;
}

export function createFrameDescription(
  text: string,
  className = "",
): HTMLDivElement {
  return createElement("div", {
    className: cn(frameDescriptionVariants(), className),
    textContent: text,
    attributes: { "data-slot": "frame-panel-description" },
  }) as HTMLDivElement;
}

export function createFrameFooter(className = ""): HTMLElement {
  return createElement("footer", {
    className: cn(frameFooterVariants(), className),
    attributes: { "data-slot": "frame-panel-footer" },
  });
}
