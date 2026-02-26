<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import "demo/overlay";
  import { Moon, Sun } from "@lucide/svelte";
  import { applyTheme, getInitialTheme, toggleTheme } from "example-ui/theme";
  import type { Theme } from "example-ui/theme";
  import { createDemoApi } from "demo/overlay";
  import type { BridgeSocketBridgeState } from "demo/overlay";
  import { phaseBadgeClass, transportBadgeClass } from "example-ui/bridge";
  import SvelteIcon from "../components/icons/Svelte.svelte";

  let theme = $state<Theme>(
    typeof window !== "undefined" ? getInitialTheme() : "light",
  );
  let bridge = $state<BridgeSocketBridgeState | null>(null);
  let actionLoading = $state<string | null>(null);

  const api = createDemoApi();

  const refresh = async () => {
    try { bridge = await api.getBridgeState(); } catch {}
  };

  const handleAction = async (action: "start" | "restart" | "stop") => {
    actionLoading = action;
    try {
      if (action === "start") await api.startRuntime();
      else if (action === "restart") await api.restartRuntime();
      else await api.stopRuntime();
      bridge = await api.getBridgeState();
    } catch {}
    actionLoading = null;
  };


  let interval: ReturnType<typeof setInterval>;

  onMount(() => {
    applyTheme(theme);
    refresh();
    interval = setInterval(refresh, 2000);
  });

  onDestroy(() => clearInterval(interval));

  function handleToggle() {
    const next = toggleTheme(theme);
    theme = next;
    applyTheme(next);
  }

  const phase = $derived(bridge?.runtime.phase ?? null);
  const transportState = $derived(bridge?.transportState ?? null);
  const isTransitioning = $derived(!!actionLoading || phase === "starting" || phase === "stopping");
</script>

<div class="dp-page">
  <div class="dp-container">
    <header class="dp-header">
      <div class="dp-header-left">
        <h1>Demo</h1>
        <div class="dp-pill" style="background-color: #FF3E00">
          <SvelteIcon class="dp-pill-icon" style="color: white" aria-hidden="true" />
          <p style="color: white">SvelteKit</p>
        </div>
      </div>
    </header>

    <div class="dp-card">
      <div class="dp-card-header">
        <p class="dp-card-title">Bridge</p>
      </div>
      <div class="dp-card-content">
        <div class="dp-frame">
          <div class="dp-frame-body">
            <div class="dp-status-row">
              <span class="dp-status-label">Transport</span>
              <span class={transportBadgeClass(transportState)}>{transportState ?? '—'}</span>
            </div>
            <div class="dp-status-row">
              <span class="dp-status-label">Runtime</span>
              <span class={phaseBadgeClass(phase)}>{phase ?? '—'}</span>
            </div>
            {#if bridge?.runtime.url}
              <div class="dp-status-row">
                <span class="dp-status-label">URL</span>
                <span class="dp-status-value">{bridge.runtime.url}</span>
              </div>
            {/if}
          </div>
          <div class="dp-frame-footer">
            <button class="dp-btn" disabled={isTransitioning || phase === "running"} onclick={() => handleAction("start")}>
              {actionLoading === "start" ? "Starting…" : "Start"}
            </button>
            <button class="dp-btn" disabled={isTransitioning || phase === "stopped" || phase === "error" || phase === null} onclick={() => handleAction("restart")}>
              {actionLoading === "restart" ? "Restarting…" : "Restart"}
            </button>
            <button class="dp-btn" disabled={isTransitioning || phase === "stopped" || phase === "error" || phase === null} onclick={() => handleAction("stop")}>
              {actionLoading === "stop" ? "Stopping…" : "Stop"}
            </button>
          </div>
        </div>
      </div>
    </div>
    <button class="dp-icon-btn" onclick={handleToggle} aria-label="Toggle theme" style="align-self: center">
      {#if theme === "dark"}
        <Sun size={20} />
      {:else}
        <Moon size={20} />
      {/if}
    </button>
  </div>
</div>
