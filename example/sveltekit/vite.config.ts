import { sveltekit } from "@sveltejs/kit/vite";
import { universalOverlay } from "@example/universal-overlay";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [universalOverlay().vite(), sveltekit()],
  server: {
    fs: {
      allow: ["../shared/src", "../universal-overlay/dist"],
    },
  },
});
