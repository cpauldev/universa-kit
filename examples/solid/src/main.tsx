import "example-ui/layout.css";
import { applyTheme, getInitialTheme } from "example-ui/theme";
import "example/overlay";
import { render } from "solid-js/web";

import App from "./App";

applyTheme(getInitialTheme());

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

render(() => <App />, root);
