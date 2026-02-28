import {
  BridgeSocketBridge,
  type BridgeSocketBridgeOptions,
  type StandaloneBridgeServer,
  startStandaloneBridgeSocketBridgeServer,
} from "bridgesocket";
import { createBridgeSocketToolPreset } from "bridgesocket/preset";

import {
  resolveDemoAdapterOptions,
  resolveDemoBridgeOptions,
} from "./defaults.js";

export type DemoBridgeOptions = BridgeSocketBridgeOptions;
export type { StandaloneBridgeServer };

export class DemoBridge extends BridgeSocketBridge {
  constructor(options: DemoBridgeOptions = {}) {
    super(resolveDemoBridgeOptions(options));
  }
}

export function createDemoBridge(options: DemoBridgeOptions = {}): DemoBridge {
  return new DemoBridge(options);
}

export async function startStandaloneDemoBridgeServer(
  options: DemoBridgeOptions = {},
): Promise<StandaloneBridgeServer> {
  return startStandaloneBridgeSocketBridgeServer(
    resolveDemoBridgeOptions(options),
  );
}

export function createDemoPreset(options = {}) {
  return createBridgeSocketToolPreset(resolveDemoAdapterOptions(options));
}
