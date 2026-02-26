export function phaseBadgeClass(phase: string | null): string {
  if (phase === "running") return "dp-badge dp-badge--success";
  if (phase === "error") return "dp-badge dp-badge--error";
  if (phase === "starting" || phase === "stopping")
    return "dp-badge dp-badge--warning";
  return "dp-badge dp-badge--default";
}

export function transportBadgeClass(state: string | null): string {
  if (state === "connected") return "dp-badge dp-badge--success";
  if (state === "degraded") return "dp-badge dp-badge--warning";
  return "dp-badge dp-badge--default";
}
