import "@example/shared/layout.css";
import { applyTheme, getInitialTheme } from "@example/shared/theme";
import { createApp } from "vue";

import App from "./App.vue";

applyTheme(getInitialTheme());

createApp(App).mount("#app");
