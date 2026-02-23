import type { StandaloneBridgeServer } from "../../bridge/standalone.js";
import {
  type BridgeSocketAdapterOptions,
  ensureStandaloneBridgeSingleton,
  resolveAdapterOptions,
} from "../shared/adapter-utils.js";

const ANGULAR_CLI_BRIDGE_GLOBAL_KEY_PREFIX =
  "__BRIDGESOCKET_ANGULAR_CLI_BRIDGE__";
let angularCliBridgeInstanceCounter = 0;

function createDefaultAngularCliBridgeGlobalKey(): string {
  angularCliBridgeInstanceCounter += 1;
  return `${ANGULAR_CLI_BRIDGE_GLOBAL_KEY_PREFIX}:${process.pid}:${angularCliBridgeInstanceCounter}`;
}

function normalizeProxyContext(context: string): string {
  const withLeadingSlash = context.startsWith("/") ? context : `/${context}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function createProxyTarget(baseUrl: string): AngularCliProxyTarget {
  return {
    target: baseUrl,
    secure: false,
    changeOrigin: false,
    ws: true,
    logLevel: "warn",
  };
}

export interface AngularCliProxyTarget {
  target: string;
  secure: boolean;
  changeOrigin: boolean;
  ws: boolean;
  logLevel: "warn";
}

export type AngularCliBridgeSocketProxyConfig = Record<
  string,
  AngularCliProxyTarget
>;

export interface AngularCliBridgeSocketOptions extends BridgeSocketAdapterOptions {
  angularCliBridgeGlobalKey?: string;
  proxyContext?: string;
}

export async function startBridgeSocketAngularCliBridge(
  options: AngularCliBridgeSocketOptions = {},
): Promise<StandaloneBridgeServer> {
  const { angularCliBridgeGlobalKey, ...adapterOptions } = options;
  const resolvedOptions = resolveAdapterOptions(adapterOptions);
  const standaloneKey =
    angularCliBridgeGlobalKey ?? createDefaultAngularCliBridgeGlobalKey();

  return ensureStandaloneBridgeSingleton({
    ...resolvedOptions,
    nextBridgeGlobalKey: standaloneKey,
  });
}

export async function createBridgeSocketAngularCliProxyConfig(
  options: AngularCliBridgeSocketOptions = {},
): Promise<AngularCliBridgeSocketProxyConfig> {
  const bridge = await startBridgeSocketAngularCliBridge(options);
  const proxyContext = normalizeProxyContext(
    options.proxyContext ?? options.bridgePathPrefix ?? "/__bridgesocket",
  );
  const proxyTarget = createProxyTarget(bridge.baseUrl);

  return {
    [proxyContext]: proxyTarget,
    [`${proxyContext}/**`]: proxyTarget,
  };
}

export async function withBridgeSocketAngularCliProxyConfig(
  existingProxyConfig: AngularCliBridgeSocketProxyConfig = {},
  options: AngularCliBridgeSocketOptions = {},
): Promise<AngularCliBridgeSocketProxyConfig> {
  return {
    ...existingProxyConfig,
    ...(await createBridgeSocketAngularCliProxyConfig(options)),
  };
}
