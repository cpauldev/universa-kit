import type { MiddlewareAdapterServer } from "../shared/adapter-utils.js";
import {
  type NodeBridgeHandle,
  type NodeBridgeSocketOptions,
  attachBridgeSocketToNodeServer,
  createNodeBridgeLifecycle,
} from "./node.js";

export type HonoNodeServer = MiddlewareAdapterServer;
export type HonoBridgeSocketOptions = NodeBridgeSocketOptions;
export type HonoBridgeHandle = NodeBridgeHandle;

export const createHonoBridgeLifecycle = createNodeBridgeLifecycle;

export function attachBridgeSocketToHonoNodeServer(
  server: HonoNodeServer,
  options: HonoBridgeSocketOptions = {},
): Promise<HonoBridgeHandle> {
  return attachBridgeSocketToNodeServer(server, options);
}
