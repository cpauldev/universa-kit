import { mountOverlay } from "demo/overlay";
import "example-ui/styles.css";
import { applyTheme, getInitialTheme } from "example-ui/theme";
import { createApp } from "vue";

import App from "./App.vue";

applyTheme(getInitialTheme());
mountOverlay();

createApp(App).mount("#app");
