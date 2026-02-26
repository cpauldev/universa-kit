<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import "demo/overlay";
import { applyTheme, getInitialTheme, toggleTheme } from "example-ui/theme";
import type { Theme } from "example-ui/theme";
import { createDemoApi } from "demo/overlay";
import type { BridgeSocketBridgeState } from "demo/overlay";
import { phaseBadgeClass, transportBadgeClass } from "example-ui/bridge";
import NuxtIcon from "./components/Nuxt.vue";

const theme = ref<Theme>("light");
const bridge = ref<BridgeSocketBridgeState | null>(null);
const actionLoading = ref<string | null>(null);

const handleToggle = () => {
  const next = toggleTheme(theme.value);
  theme.value = next;
  applyTheme(next);
};

const api = createDemoApi();

const refresh = async () => {
  try { bridge.value = await api.getBridgeState(); } catch {}
};

const handleAction = async (action: "start" | "restart" | "stop") => {
  actionLoading.value = action;
  try {
    if (action === "start") await api.startRuntime();
    else if (action === "restart") await api.restartRuntime();
    else await api.stopRuntime();
    bridge.value = await api.getBridgeState();
  } catch {}
  actionLoading.value = null;
};


let interval: ReturnType<typeof setInterval>;

onMounted(() => {
  const initial = getInitialTheme();
  theme.value = initial;
  applyTheme(initial);
  refresh();
  interval = setInterval(refresh, 2000);
});

onUnmounted(() => clearInterval(interval));
</script>

<template>
  <div class="dp-page">
    <div class="dp-container">
      <header class="dp-header">
        <div class="dp-header-left">
          <h1>Demo</h1>
          <div class="dp-pill" style="background-color: #00DC82">
            <NuxtIcon class="dp-pill-icon" style="color: black" aria-hidden="true" />
            <p style="color: black">Nuxt</p>
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
                <span :class="transportBadgeClass(bridge?.transportState ?? null)">{{ bridge?.transportState ?? '—' }}</span>
              </div>
              <div class="dp-status-row">
                <span class="dp-status-label">Runtime</span>
                <span :class="phaseBadgeClass(bridge?.runtime.phase ?? null)">{{ bridge?.runtime.phase ?? '—' }}</span>
              </div>
              <div v-if="bridge?.runtime.url" class="dp-status-row">
                <span class="dp-status-label">URL</span>
                <span class="dp-status-value">{{ bridge.runtime.url }}</span>
              </div>
            </div>
            <div class="dp-frame-footer">
              <button class="dp-btn" :disabled="!!actionLoading || bridge?.runtime.phase === 'starting' || bridge?.runtime.phase === 'stopping' || bridge?.runtime.phase === 'running'" @click="handleAction('start')">
                {{ actionLoading === 'start' ? 'Starting…' : 'Start' }}
              </button>
              <button class="dp-btn" :disabled="!!actionLoading || bridge?.runtime.phase === 'starting' || bridge?.runtime.phase === 'stopping' || bridge?.runtime.phase === 'stopped' || bridge?.runtime.phase === 'error' || !bridge" @click="handleAction('restart')">
                {{ actionLoading === 'restart' ? 'Restarting…' : 'Restart' }}
              </button>
              <button class="dp-btn" :disabled="!!actionLoading || bridge?.runtime.phase === 'starting' || bridge?.runtime.phase === 'stopping' || bridge?.runtime.phase === 'stopped' || bridge?.runtime.phase === 'error' || !bridge" @click="handleAction('stop')">
                {{ actionLoading === 'stop' ? 'Stopping…' : 'Stop' }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <button class="dp-icon-btn" @click="handleToggle" aria-label="Toggle theme" style="align-self: center">
        <LucideSun v-if="theme === 'dark'" size="20" />
        <LucideMoon v-else size="20" />
      </button>
    </div>
  </div>
</template>

<style>
@import "example-ui/styles.css";
</style>
