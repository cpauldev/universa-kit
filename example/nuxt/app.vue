<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

import { mountExampleDashboard } from "@example/shared/dashboard-client";

const root = ref<HTMLElement | null>(null);
let cleanup: (() => void) | null = null;

onMounted(() => {
  if (!root.value) {
    throw new Error("Missing dashboard root");
  }

  cleanup = mountExampleDashboard({
    root: root.value,
    frameworkId: "nuxt",
  });
});

onUnmounted(() => {
  cleanup?.();
  cleanup = null;
});
</script>

<template>
  <div ref="root" />
</template>
