import { sveltekit } from "@sveltejs/kit/vite";
import demo from "demo";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [demo.vite(), sveltekit()],
  server: {
    fs: {
      allow: ["../shared/ui/src"],
    },
  },
});
