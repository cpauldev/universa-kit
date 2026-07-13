import vue from "@vitejs/plugin-vue";
import { universalOverlay } from "@example/universal-overlay";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [universalOverlay().vite(), vue()],
});
