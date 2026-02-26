import demo from "demo";
import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [demo.vite(), vinext()],
  resolve: {
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
