import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import { OVERLAY_MOUNT_ROOT_SELECTOR } from "../constants.js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getOverlayPortalContainer(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(OVERLAY_MOUNT_ROOT_SELECTOR);
}
