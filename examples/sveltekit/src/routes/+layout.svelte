<script lang="ts">
  import { onMount } from "svelte";
  import { applyTheme, getInitialTheme } from "example-ui/theme";
  import { mountOverlay } from "demo/overlay";
  import "example-ui/styles.css";

  onMount(() => {
    applyTheme(getInitialTheme());
    mountOverlay();
  });
</script>

<slot />
