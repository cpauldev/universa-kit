// Browser-only public surface. Package export conditions select this module
// for client bundles so server dependencies never enter the browser graph.
export * from "./client/index.js";
