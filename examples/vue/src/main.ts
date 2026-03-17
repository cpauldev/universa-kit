import "example-ui/layout.css";
import { applyTheme, getInitialTheme } from "example-ui/theme";
import "example/overlay";
import { createApp } from "vue";

import App from "./App.vue";

applyTheme(getInitialTheme());

createApp(App).mount("#app");
