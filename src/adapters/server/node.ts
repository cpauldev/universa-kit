import type { BridgeSocketBridge } from "../../bridge/bridge.js";
import {
  type BridgeLifecycle,
  type BridgeSocketAdapterOptions,
  type MiddlewareAdapterServer,
  createBridgeLifecycle,
} from "../shared/adapter-utils.js";

export type NodeBridgeSocketOptions = BridgeSocketAdapterOptions;

export interface NodeBridgeHandle {
  bridge: BridgeSocketBridge;
  close: () => Promise<void>;
}

export function createNodeBridgeLifecycle(
  options: NodeBridgeSocketOptions = {},
): BridgeLifecycle {
  return createBridgeLifecycle(options);
}

export async function attachBridgeSocketToNodeServer(
  server: MiddlewareAdapterServer,
  options: NodeBridgeSocketOptions = {},
): Promise<NodeBridgeHandle> {
  const lifecycle = createNodeBridgeLifecycle(options);
  const bridge = await lifecycle.setup(server);
  return {
    bridge,
    close: async () => {
      await lifecycle.teardown();
    },
  };
}
