import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();

const overlayCssPath = path.resolve(rootDir, "dist/overlay.css");
const overlayBundlePath = path.resolve(rootDir, "dist/overlay/overlay.js");
const tailwindCliPath = path.resolve(
  rootDir,
  "node_modules/@tailwindcss/cli/dist/index.mjs",
);
const tscPath = path.resolve(rootDir, "node_modules/typescript/bin/tsc");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Command failed (${code ?? "unknown"}): ${command} ${args.join(" ")}`,
        ),
      );
    });
  });
}

/**
 * Tailwind v4 wraps the @layer properties fallback block in an @supports
 * condition that Chrome 130+ evaluates as false (color:rgb(from red r g b) is
 * now supported). When CSS is loaded via adoptedStyleSheets, @property rules
 * also don't register globally. Strip the @supports wrapper so the --tw-*
 * initial values always apply inside the shadow DOM.
 */
async function stripLayerPropertiesSupports() {
  const css = await fs.readFile(overlayCssPath, "utf8");
  const fixed = css.replace(
    /@layer properties\{@supports [^{]+\{([\s\S]*?)\}\}/,
    "@layer properties{$1}",
  );
  if (fixed !== css) {
    await fs.writeFile(overlayCssPath, fixed);
  }
}

async function inlineOverlayCss() {
  const [css, overlayBundle] = await Promise.all([
    fs.readFile(overlayCssPath, "utf8"),
    fs.readFile(overlayBundlePath, "utf8"),
  ]);

  const marker = /(["'`])__EXAMPLE_OVERLAY_CSS_INLINE__\1/;
  const placeholder =
    /(?:var|let|const)\s+__OVERLAY_CSS_INLINE__\s*=\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/;

  let patched = overlayBundle;
  if (marker.test(patched)) {
    patched = patched.replace(marker, () => JSON.stringify(css));
  } else if (placeholder.test(patched)) {
    patched = patched.replace(
      placeholder,
      () => `const __OVERLAY_CSS_INLINE__ = ${JSON.stringify(css)}`,
    );
  } else {
    throw new Error(
      "Failed to inline overlay CSS: marker __EXAMPLE_OVERLAY_CSS_INLINE__ was not found in dist/overlay/overlay.js",
    );
  }

  await fs.writeFile(overlayBundlePath, patched);
}

async function build() {
  await fs.rm(path.resolve(rootDir, "dist"), { recursive: true, force: true });

  await run(process.execPath, [
    tailwindCliPath,
    "-i",
    "src/overlay/styles/overlay.css",
    "-o",
    "dist/overlay.css",
    "--minify",
  ]);

  await stripLayerPropertiesSupports();
  await run(process.execPath, [tscPath, "-p", "tsconfig.build.json"]);
  await inlineOverlayCss();
}

build().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
