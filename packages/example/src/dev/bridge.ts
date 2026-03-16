import {
  type StandaloneBridgeServer,
  UniversaBridge,
  type UniversaBridgeOptions,
  startStandaloneUniversaBridgeServer,
} from "universa-kit";
import { createUniversaPreset } from "universa-kit/preset";

import {
  type ExampleConfigOptions,
  resolveExampleBridgeOptions,
  resolveExampleConfigOptions,
} from "./defaults";

export type ExampleBridgeOptions = UniversaBridgeOptions;
export type { StandaloneBridgeServer };

export class ExampleBridge extends UniversaBridge {
  constructor(options: ExampleBridgeOptions = {}) {
    super(resolveExampleBridgeOptions(options));
  }
}

export function createExampleBridge(
  options: ExampleBridgeOptions = {},
): ExampleBridge {
  return new ExampleBridge(options);
}

export async function startStandaloneExampleBridgeServer(
  options: ExampleBridgeOptions = {},
): Promise<StandaloneBridgeServer> {
  return startStandaloneUniversaBridgeServer(
    resolveExampleBridgeOptions(options),
  );
}

export function example(options: ExampleConfigOptions = {}) {
  return createUniversaPreset(resolveExampleConfigOptions(options));
}
