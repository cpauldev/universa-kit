import { mountOverlay } from "demo/overlay";
import "example-ui/styles.css";
import { applyTheme, getInitialTheme } from "example-ui/theme";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";

applyTheme(getInitialTheme());
mountOverlay();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
