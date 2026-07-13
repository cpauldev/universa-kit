type AttributeValue = string | number | boolean | null | undefined;
type DatasetValue = string | number | boolean | null | undefined;
type ChildValue = Node | string;

export interface ElementOptions {
  className?: string;
  textContent?: string;
  attributes?: Record<string, AttributeValue>;
  dataset?: Record<string, DatasetValue>;
  dir?: HTMLElement["dir"];
  children?: ChildValue[];
}

function setAttributes(
  element: Element,
  attributes?: Record<string, AttributeValue>,
): void {
  if (!attributes) return;
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) {
      element.removeAttribute(key);
      continue;
    }

    if (value === true) {
      element.setAttribute(key, "");
      continue;
    }

    element.setAttribute(key, String(value));
  }
}

function setDataset(
  element: HTMLElement,
  dataset?: Record<string, DatasetValue>,
): void {
  if (!dataset) return;
  for (const [key, value] of Object.entries(dataset)) {
    if (value === null || value === undefined) {
      delete element.dataset[key];
      continue;
    }
    element.dataset[key] = String(value);
  }
}

function appendChildren(element: HTMLElement, children?: ChildValue[]): void {
  if (!children || children.length === 0) return;
  const nodes = children.map((child) =>
    typeof child === "string" ? document.createTextNode(child) : child,
  );
  element.append(...nodes);
}

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (typeof options.textContent === "string") {
    node.textContent = options.textContent;
  }
  if (options.dir) node.dir = options.dir;
  setAttributes(node, options.attributes);
  setDataset(node, options.dataset);
  appendChildren(node, options.children);
  return node;
}
