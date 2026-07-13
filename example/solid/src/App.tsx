import { mountExampleDashboard } from "@example/shared/dashboard-client";
import { onCleanup, onMount } from "solid-js";

export default function App() {
  let root: HTMLDivElement | undefined;

  onMount(() => {
    if (!root) return;
    const cleanup = mountExampleDashboard({
      root,
      frameworkId: "solid",
    });

    onCleanup(() => {
      cleanup();
    });
  });

  return (
    <div
      ref={(el) => {
        root = el;
      }}
    />
  );
}
