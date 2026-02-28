import fs from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";

const SCOPE_ID = "overlay-host";
const SCOPE_SELECTOR = `#${SCOPE_ID}`;
const inputPath = path.resolve("dist/overlay.unscoped.css");
const outputPath = path.resolve("dist/overlay.css");

function isKeyframesRule(rule) {
  let current = rule.parent;
  while (current) {
    if (current.type === "atrule" && /keyframes$/i.test(current.name)) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

const normalizeSelector = selectorParser((selectors) => {
  selectors.each((selector) => {
    selector.walkPseudos((node) => {
      if (node.value === ":root" || node.value === ":host") {
        node.replaceWith(selectorParser.id({ value: SCOPE_ID }));
      }
    });

    selector.walkTags((node) => {
      if (node.value === "html" || node.value === "body") {
        node.replaceWith(selectorParser.id({ value: SCOPE_ID }));
      }
    });
  });
});

function scopeSelector(selector) {
  const normalized = normalizeSelector.processSync(selector, {
    lossless: false,
  });
  if (normalized.includes(SCOPE_SELECTOR)) {
    return normalized;
  }
  return `${SCOPE_SELECTOR} ${normalized}`;
}

const sourceCss = await fs.readFile(inputPath, "utf8");
const root = postcss.parse(sourceCss);

root.walkRules((rule) => {
  if (isKeyframesRule(rule)) return;
  if (!Array.isArray(rule.selectors) || rule.selectors.length === 0) return;

  rule.selectors = [...new Set(rule.selectors.map(scopeSelector))];
});

await fs.writeFile(outputPath, root.toResult().css);
await fs.rm(inputPath, { force: true });
