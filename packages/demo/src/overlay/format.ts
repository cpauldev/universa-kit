export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

export function formatLastUpdated(timestamp: number | null): string {
  if (!timestamp) return "n/a";
  return new Date(timestamp).toLocaleTimeString();
}

export function formatUptime(startedAt: number): string {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function formatTransportState(state: string): string {
  switch (state) {
    case "connected":
      return "Connected";
    case "disconnected":
      return "Disconnected";
    case "bridge_detecting":
      return "Detecting";
    case "runtime_starting":
      return "Starting";
    case "degraded":
      return "Degraded";
    default:
      return state;
  }
}

export function formatPhase(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}
