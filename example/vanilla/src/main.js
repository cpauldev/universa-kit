/* global document, window */

import { mountExampleDashboard } from "@example/shared/dashboard-client";
import "@example/shared/layout.css";

const root = document.getElementById("example-root");
if (!root) {
  throw new Error("Missing #example-root");
}

const cleanup = mountExampleDashboard({
  root,
  frameworkId: "vanilla",
});

window.addEventListener("unload", cleanup);
