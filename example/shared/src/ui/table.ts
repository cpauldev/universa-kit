import { cva } from "class-variance-authority";

import { createElement } from "./dom";
import { cn } from "./utils";

export const tableContainerVariants = cva("relative w-full overflow-x-auto");

export const tableVariants = cva(
  "w-full caption-bottom in-data-[slot=frame]:border-separate in-data-[slot=frame]:border-spacing-0 text-sm",
);

export const tableHeaderVariants = cva(
  "[&_tr]:border-b in-data-[slot=frame]:**:[th]:h-9 in-data-[slot=frame]:*:[tr]:border-none in-data-[slot=frame]:*:[tr]:hover:bg-transparent",
);

export const tableBodyVariants = cva(
  "relative in-data-[slot=frame]:rounded-xl in-data-[slot=frame]:shadow-xs before:pointer-events-none before:absolute before:inset-px not-in-data-[slot=frame]:before:hidden before:rounded-[calc(var(--radius-xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:bg-clip-border dark:before:shadow-[0_-1px_--theme(--color-white/8%)] [&_tr:last-child]:border-0 in-data-[slot=frame]:*:[tr]:border-0 in-data-[slot=frame]:*:[tr]:*:[td]:border-b in-data-[slot=frame]:*:[tr]:*:[td]:bg-background in-data-[slot=frame]:*:[tr]:*:[td]:bg-clip-padding in-data-[slot=frame]:*:[tr]:first:*:[td]:first:rounded-ss-xl in-data-[slot=frame]:*:[tr]:*:[td]:first:border-s in-data-[slot=frame]:*:[tr]:first:*:[td]:border-t in-data-[slot=frame]:*:[tr]:last:*:[td]:last:rounded-ee-xl in-data-[slot=frame]:*:[tr]:*:[td]:last:border-e in-data-[slot=frame]:*:[tr]:first:*:[td]:last:rounded-se-xl in-data-[slot=frame]:*:[tr]:last:*:[td]:first:rounded-es-xl in-data-[slot=frame]:*:[tr]:hover:*:[td]:bg-transparent in-data-[slot=frame]:*:[tr]:data-[state=selected]:*:[td]:bg-muted/50",
);

export const tableRowVariants = cva(
  "border-b transition-colors hover:bg-muted/50 in-data-[slot=frame]:hover:bg-transparent data-[state=selected]:bg-muted/50 in-data-[slot=frame]:data-[state=selected]:bg-transparent",
);

export const tableHeadVariants = cva(
  "h-10 whitespace-nowrap px-2 text-start align-middle font-medium text-muted-foreground has-[[role=checkbox]]:w-px has-[[role=checkbox]]:pe-0 *:[[role=checkbox]]:translate-y-0.5",
);

export const tableCellVariants = cva(
  "whitespace-nowrap p-2 align-middle has-[[role=checkbox]]:pe-0 *:[[role=checkbox]]:translate-y-0.5",
);

export const tableFooterVariants = cva(
  "border-t in-data-[slot=frame]:border-none bg-muted/50 in-data-[slot=frame]:bg-transparent font-medium [&>tr]:last:border-b-0 in-data-[slot=frame]:*:[tr]:hover:bg-transparent",
);

export const tableCaptionVariants = cva(
  "in-data-[slot=frame]:my-4 mt-4 text-muted-foreground text-sm",
);

export function createTableContainer(className = ""): HTMLDivElement {
  return createElement("div", {
    className: cn(tableContainerVariants(), className),
    attributes: { "data-slot": "table-container" },
  }) as HTMLDivElement;
}

export function createTable(className = ""): HTMLTableElement {
  return createElement("table", {
    className: cn(tableVariants(), className),
    attributes: { "data-slot": "table" },
  }) as HTMLTableElement;
}

export function createTableHeader(className = ""): HTMLTableSectionElement {
  return createElement("thead", {
    className: cn(tableHeaderVariants(), className),
    attributes: { "data-slot": "table-header" },
  }) as HTMLTableSectionElement;
}

export function createTableBody(className = ""): HTMLTableSectionElement {
  return createElement("tbody", {
    className: cn(tableBodyVariants(), className),
    attributes: { "data-slot": "table-body" },
  }) as HTMLTableSectionElement;
}

export function createTableHead(className = ""): HTMLTableCellElement {
  return createElement("th", {
    className: cn(tableHeadVariants(), className),
    attributes: { "data-slot": "table-head" },
  }) as HTMLTableCellElement;
}

export function createTableRow(className = ""): HTMLTableRowElement {
  return createElement("tr", {
    className: cn(tableRowVariants(), className),
    attributes: { "data-slot": "table-row" },
  }) as HTMLTableRowElement;
}

export function createTableCell(className = ""): HTMLTableCellElement {
  return createElement("td", {
    className: cn(tableCellVariants(), className),
    attributes: { "data-slot": "table-cell" },
  }) as HTMLTableCellElement;
}

export function createTableFooter(className = ""): HTMLTableSectionElement {
  return createElement("tfoot", {
    className: cn(tableFooterVariants(), className),
    attributes: { "data-slot": "table-footer" },
  }) as HTMLTableSectionElement;
}

export function createTableCaption(className = ""): HTMLTableCaptionElement {
  return createElement("caption", {
    className: cn(tableCaptionVariants(), className),
    attributes: { "data-slot": "table-caption" },
  }) as HTMLTableCaptionElement;
}
