import { universalOverlay } from "@example/universal-overlay";

export default defineNuxtConfig({
  ssr: false,
  modules: [universalOverlay().nuxt()],
  css: ["@example/shared/layout.css"],
  build: {
    transpile: ["@example/shared"],
  },
  compatibilityDate: "2024-04-03",
  app: {
    head: {
      title: "Universal Bridge — Nuxt",
      link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    },
  },
});
