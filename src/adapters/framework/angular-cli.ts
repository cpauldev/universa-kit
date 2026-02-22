import type { StandaloneBridgeServer } from "../../bridge/standalone.js";
import {
  type DevSocketAdapterOptions,
  ensureStandaloneBridgeSingleton,
  resolveAdapterOptions,
} from "../shared/adapter-utils.js";

const ANGULAR_CLI_BRIDGE_GLOBAL_KEY_PREFIX = "__DEVSOCKET_ANGULAR_CLI_BRIDGE__";
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

export type AngularCliDevSocketProxyConfig = Record<
  string,
  AngularCliProxyTarget
>;

export interface AngularCliDevSocketOptions extends DevSocketAdapterOptions {
  angularCliBridgeGlobalKey?: string;
  proxyContext?: string;
}

export async function startDevSocketAngularCliBridge(
  options: AngularCliDevSocketOptions = {},
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

export async function createDevSocketAngularCliProxyConfig(
  options: AngularCliDevSocketOptions = {},
): Promise<AngularCliDevSocketProxyConfig> {
  const bridge = await startDevSocketAngularCliBridge(options);
  const proxyContext = normalizeProxyContext(
    options.proxyContext ?? options.bridgePathPrefix ?? "/__devsocket",
  );
  const proxyTarget = createProxyTarget(bridge.baseUrl);

  return {
    [proxyContext]: proxyTarget,
    [`${proxyContext}/**`]: proxyTarget,
  };
}

export async function withDevSocketAngularCliProxyConfig(
  existingProxyConfig: AngularCliDevSocketProxyConfig = {},
  options: AngularCliDevSocketOptions = {},
): Promise<AngularCliDevSocketProxyConfig> {
  return {
    ...existingProxyConfig,
    ...(await createDevSocketAngularCliProxyConfig(options)),
  };
}
