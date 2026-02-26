import { defineConfig } from "astro/config";
import demo from "demo";

export default defineConfig({
  integrations: [demo.astro()],
});
