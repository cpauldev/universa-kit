<script lang="ts">
  import { onMount } from "svelte";
  import "example/overlay";
  import { applyTheme, getInitialTheme } from "example-ui/theme";
  import "example-ui/layout.css";

  onMount(() => {
    applyTheme(getInitialTheme());
  });
</script>

<slot />
