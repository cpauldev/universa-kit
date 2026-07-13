import react from "@vitejs/plugin-react";
import { universalOverlay } from "@example/universal-overlay";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [universalOverlay().vite(), react()],
});
