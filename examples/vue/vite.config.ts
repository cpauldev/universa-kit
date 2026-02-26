import vue from "@vitejs/plugin-vue";
import demo from "demo";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [demo.vite(), vue()],
});
