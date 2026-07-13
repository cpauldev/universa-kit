import { cva } from "class-variance-authority";

import { createElement } from "./dom";
import { cn } from "./utils";

export const cardVariants = cva(
  "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border border-border/70 py-6 shadow-sm",
);

export const cardHeaderVariants = cva(
  "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
);

export const cardTitleVariants = cva("leading-none font-semibold");

export const cardDescriptionVariants = cva("text-muted-foreground text-sm");

export const cardContentVariants = cva("px-6");

export const cardActionVariants = cva(
  "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
);

export const cardFooterVariants = cva(
  "flex items-center px-6 [.border-t]:pt-6",
);

export function createCard(className = ""): HTMLDivElement {
  return createElement("div", {
    className: cn(cardVariants(), className),
    attributes: { "data-slot": "card" },
  }) as HTMLDivElement;
}

export function createCardHeader(className = ""): HTMLDivElement {
  return createElement("div", {
    className: cn(cardHeaderVariants(), className),
    attributes: { "data-slot": "card-header" },
  }) as HTMLDivElement;
}

export function createCardTitle(
  text: string,
  className = "",
): HTMLHeadingElement {
  return createElement("h4", {
    className: cn(cardTitleVariants(), className),
    textContent: text,
    attributes: { "data-slot": "card-title" },
  }) as HTMLHeadingElement;
}

export function createCardDescription(
  text: string,
  className = "",
): HTMLParagraphElement {
  return createElement("p", {
    className: cn(cardDescriptionVariants(), className),
    textContent: text,
    attributes: { "data-slot": "card-description" },
  }) as HTMLParagraphElement;
}

export function createCardContent(className = ""): HTMLDivElement {
  return createElement("div", {
    className: cn(cardContentVariants(), className),
    attributes: { "data-slot": "card-content" },
  }) as HTMLDivElement;
}

export function createCardAction(className = ""): HTMLDivElement {
  return createElement("div", {
    className: cn(cardActionVariants(), className),
    attributes: { "data-slot": "card-action" },
  }) as HTMLDivElement;
}

export function createCardFooter(className = ""): HTMLDivElement {
  return createElement("div", {
    className: cn(cardFooterVariants(), className),
    attributes: { "data-slot": "card-footer" },
  }) as HTMLDivElement;
}
