<script lang="ts">
  import { onMount } from "svelte";

  import { mountExampleDashboard } from "@example/shared/dashboard-client";

  let root: HTMLDivElement | null = null;

  onMount(() => {
    if (!root) {
      throw new Error("Missing dashboard root");
    }

    const cleanup = mountExampleDashboard({
      root,
      frameworkId: "sveltekit",
    });

    return () => {
      cleanup();
    };
  });
</script>

<div bind:this={root}></div>
