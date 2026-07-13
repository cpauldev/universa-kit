import { universalOverlay } from "@example/universal-overlay";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [universalOverlay().vite(), solid()],
});
