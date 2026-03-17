import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import { OVERLAY_MOUNT_ROOT_SELECTOR } from "../constants.js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Set by overlay.ts on mount/destroy so portals can target the shadow-root
// container (document.querySelector cannot pierce shadow boundaries).
let overlayPortalContainer: HTMLElement | null = null;

export function setOverlayPortalContainer(el: HTMLElement | null): void {
  overlayPortalContainer = el;
}

export function getOverlayPortalContainer(): HTMLElement | null {
  if (overlayPortalContainer) return overlayPortalContainer;
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(OVERLAY_MOUNT_ROOT_SELECTOR);
}
