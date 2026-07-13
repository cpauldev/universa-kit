import { cva } from "class-variance-authority";

import { createElement } from "./dom";
import { cn } from "./utils";

export const fieldVariants = cva("grid gap-2");

export const labelVariants = cva(
  "inline-flex items-center gap-2 font-medium text-base/4.5 sm:text-sm/4",
);

export function createField(className = ""): HTMLDivElement {
  return createElement("div", {
    className: cn(fieldVariants(), className),
    attributes: { "data-slot": "field" },
  }) as HTMLDivElement;
}

export function createFieldLabel(
  text: string,
  htmlFor?: string,
  className = "",
): HTMLLabelElement {
  return createElement("label", {
    className: cn(labelVariants(), className),
    textContent: text,
    attributes: {
      ...(htmlFor ? { for: htmlFor } : {}),
      "data-slot": "field-label",
    },
  }) as HTMLLabelElement;
}
