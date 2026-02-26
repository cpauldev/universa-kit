import demo from "demo";

export default defineNuxtConfig({
  ssr: false,
  modules: ["nuxt-lucide-icons", demo.nuxt()],
  transpilePackages: ["example-ui"],
  compatibilityDate: "2024-04-03",
  app: {
    head: {
      link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    },
  },
});
