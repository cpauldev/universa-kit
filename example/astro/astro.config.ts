import { defineConfig } from "astro/config";
import { universalOverlay } from "@example/universal-overlay";

export default defineConfig({
  integrations: [universalOverlay().astro()],
});
