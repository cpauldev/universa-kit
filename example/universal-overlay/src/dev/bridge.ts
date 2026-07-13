import { UniversalBridge, type UniversalBridgeOptions } from "universal-bridge";
import {
  createUniversalPreset,
  type UniversalPreset,
} from "universal-bridge/preset";

import {
  type UniversalOverlayOptions,
  resolveOverlayBridgeOptions,
  resolveUniversalOverlayOptions,
} from "./defaults.js";

export type OverlayBridgeOptions = UniversalBridgeOptions;

export class OverlayBridge extends UniversalBridge {
  constructor(options: OverlayBridgeOptions = {}) {
    super(resolveOverlayBridgeOptions(options));
  }
}

export function universalOverlay(
  options: UniversalOverlayOptions = {},
): UniversalPreset {
  const presetOptions = resolveUniversalOverlayOptions(options);
  return createUniversalPreset({
    ...presetOptions,
    client: {
      entries: [
        { module: "@example/universal-overlay/overlay" },
        ...(presetOptions.client?.entries ?? []),
      ],
    },
  });
}
