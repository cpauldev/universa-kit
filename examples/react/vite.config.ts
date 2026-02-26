import react from "@vitejs/plugin-react";
import demo from "demo";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [demo.vite(), react()],
});
