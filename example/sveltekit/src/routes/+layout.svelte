<script lang="ts">
  import { onMount } from "svelte";
  import { applyTheme, getInitialTheme } from "@example/shared/theme";
  import "@example/shared/layout.css";

  onMount(() => {
    applyTheme(getInitialTheme());
  });
</script>

<slot />
