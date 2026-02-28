import type {
  BridgeSocketBridgeOptions,
  RuntimeHelperOptions,
} from "bridgesocket";
import type { BridgeSocketAdapterOptions } from "bridgesocket/internal";
import { existsSync } from "fs";
import { basename, dirname, join } from "path";
import { fileURLToPath } from "url";

export const DEMO_ADAPTER_NAME = "demo-bridge";
export const DEMO_BRIDGE_PATH_PREFIX = "/__demo";
export const DEMO_BRIDGE_REWRITE_SOURCE = "/__demo/:path*";
export const DEMO_NEXT_BRIDGE_GLOBAL_KEY = "__DEMO_NEXT_BRIDGE__";
export const DEMO_RUNTIME_HEALTH_PATH = "/api/version";
export const DEMO_RUNTIME_PORT_ENV_VAR = "DEMO_RUNTIME_PORT";
export const DEMO_RUNTIME_FALLBACK_COMMAND = "demo dev";
export const DEMO_INSTANCE_ID_FALLBACK = "demo";

type DemoInstanceOptions = {
  id?: string;
  label?: string;
};

type DemoBridgeOptions = BridgeSocketBridgeOptions & {
  instance?: DemoInstanceOptions;
  proxyRuntimeWebSocket?: boolean;
};

function resolveDemoRuntimeScript(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  // Support both preserved-module output (dist/dev/defaults.js) and bundled output (dist/index.js).
  const bundledOutputPath = join(currentDir, "runtime", "server.js");
  if (existsSync(bundledOutputPath)) {
    return bundledOutputPath;
  }

  return join(currentDir, "..", "runtime", "server.js");
}

function resolveCommand(
  command?: string,
  args?: string[],
): { command: string; args: string[] } {
  if (command) {
    return { command, args: args ?? [] };
  }

  const defaultCommand =
    typeof process !== "undefined" && process.versions?.bun && process.execPath
      ? process.execPath
      : "bun";

  return {
    command: defaultCommand,
    args: args ?? [resolveDemoRuntimeScript()],
  };
}

function sanitizeInstanceId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || DEMO_INSTANCE_ID_FALLBACK;
}

function deriveDefaultInstanceId(cwd?: string): string {
  return sanitizeInstanceId(basename((cwd || process.cwd()).trim()));
}

function resolveDemoInstance(options: DemoBridgeOptions): DemoInstanceOptions {
  const providedId = options.instance?.id?.trim();
  const id = providedId
    ? sanitizeInstanceId(providedId)
    : deriveDefaultInstanceId(options.cwd);
  const label = options.instance?.label?.trim();
  return {
    id,
    ...(label ? { label } : {}),
  };
}

export function resolveDemoRuntimeOptions(
  options: RuntimeHelperOptions = {},
): RuntimeHelperOptions {
  const resolvedCommand = resolveCommand(options.command, options.args);

  return {
    ...options,
    command: resolvedCommand.command,
    args: resolvedCommand.args,
    healthPath: options.healthPath ?? DEMO_RUNTIME_HEALTH_PATH,
    runtimePortEnvVar: options.runtimePortEnvVar ?? DEMO_RUNTIME_PORT_ENV_VAR,
  };
}

export function resolveDemoBridgeOptions(
  options: BridgeSocketBridgeOptions = {},
): BridgeSocketBridgeOptions {
  const bridgeOptions = options as DemoBridgeOptions;
  const instance = resolveDemoInstance(bridgeOptions);

  return {
    ...resolveDemoRuntimeOptions(options),
    bridgePathPrefix: options.bridgePathPrefix ?? DEMO_BRIDGE_PATH_PREFIX,
    fallbackCommand: options.fallbackCommand ?? DEMO_RUNTIME_FALLBACK_COMMAND,
    proxyRuntimeWebSocket: bridgeOptions.proxyRuntimeWebSocket ?? false,
    instance,
  } as BridgeSocketBridgeOptions;
}

export function resolveDemoAdapterOptions(
  options: BridgeSocketAdapterOptions = {},
): BridgeSocketAdapterOptions {
  return {
    ...resolveDemoBridgeOptions(options),
    adapterName: options.adapterName ?? DEMO_ADAPTER_NAME,
    rewriteSource: options.rewriteSource ?? DEMO_BRIDGE_REWRITE_SOURCE,
    nextBridgeGlobalKey:
      options.nextBridgeGlobalKey ?? DEMO_NEXT_BRIDGE_GLOBAL_KEY,
    overlayModule: options.overlayModule ?? "demo/overlay",
  };
}
