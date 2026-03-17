import { example } from "example";
import { resolve } from "path";
import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [example().vite(), vinext()],
  server: {
    watch: {
      // Running multiple examples generates Nuxt files under ../nuxt/.nuxt.
      // Ignore those updates so Vinext doesn't force full reload loops.
      ignored: ["../nuxt/.nuxt/**"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
    // Prevent duplicate React instances when packages are resolved from
    // multiple locations in the Bun workspace (mirrors vinext CLI auto-config).
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  optimizeDeps: {
    // react-server-dom-webpack ships CJS only. In Bun workspaces, Vite
    // serves it from the .bun/ cache path which bypasses CJS auto-detection,
    // causing "module is not defined" in the browser. Force pre-bundling.
    include: ["react-server-dom-webpack/client.browser"],
  },
});
