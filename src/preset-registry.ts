import type { UniversaAdapterOptions } from "./adapters/shared/adapter-utils.js";

export type UniversaPresetIdentity = {
  packageName: string;
  variant?: string;
};

export type UniversaCompositionMode = "registry" | "local";

type UnsafeOverrides = Partial<{
  adapterName: string;
  nextBridgeGlobalKey: string;
}>;

type BasePresetAdapterOptions = Omit<
  UniversaAdapterOptions,
  "bridgePathPrefix" | "rewriteSource" | "adapterName" | "nextBridgeGlobalKey"
>;

export type UniversaPresetOptions = BasePresetAdapterOptions & {
  identity: UniversaPresetIdentity;
  composition?: UniversaCompositionMode;
  instanceId?: string;
  unsafeOverrides?: UnsafeOverrides;
};

export interface UniversaNamespaceMetadata {
  canonicalIdentity: string;
  baseId: string;
  namespaceId: string;
  keyPrefix: string;
}

export interface UniversaPresetRegistration {
  id: string;
  order: number;
  fingerprint: string;
  identity: UniversaPresetIdentity;
  composition: UniversaCompositionMode;
  namespace: UniversaNamespaceMetadata;
  effectiveOptions: UniversaAdapterOptions;
}

type PresetRegistryStore = {
  entries: UniversaPresetRegistration[];
  nextOrder: number;
  baseIdCounts: Map<string, number>;
  byFingerprint: Map<string, UniversaPresetRegistration>;
  usedNamespaces: Set<string>;
};

const PRESET_REGISTRY_SYMBOL = Symbol.for("universa.preset.registry");
const NEXT_BRIDGE_GLOBAL_KEY_PREFIX = "__UNIVERSA_NEXT_BRIDGE__:";
const BRIDGE_PATH_PREFIX = "/__universa";
const ADAPTER_PREFIX = "universa";

function getRegistryStore(): PresetRegistryStore {
  const runtimeGlobal = globalThis as typeof globalThis & {
    [PRESET_REGISTRY_SYMBOL]?: PresetRegistryStore;
  };

  if (!runtimeGlobal[PRESET_REGISTRY_SYMBOL]) {
    runtimeGlobal[PRESET_REGISTRY_SYMBOL] = {
      entries: [],
      nextOrder: 0,
      baseIdCounts: new Map<string, number>(),
      byFingerprint: new Map<string, UniversaPresetRegistration>(),
      usedNamespaces: new Set<string>(),
    };
  }

  return runtimeGlobal[PRESET_REGISTRY_SYMBOL] as PresetRegistryStore;
}

function sanitizeSegment(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[\\/]/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function canonicalizeIdentity(identity: UniversaPresetIdentity): {
  packageName: string;
  variant?: string;
  canonicalIdentity: string;
} {
  const packageName = identity.packageName?.trim();
  if (!packageName) {
    throw new Error(
      "createUniversaPreset requires identity.packageName (non-empty).",
    );
  }

  const variant = identity.variant?.trim();
  const canonicalIdentity = `${packageName}:${variant || "default"}`;
  return {
    packageName,
    ...(variant ? { variant } : {}),
    canonicalIdentity,
  };
}

function createBaseId(packageName: string, variant?: string): string {
  const packageSlug = sanitizeSegment(packageName, "preset");
  if (!variant || variant === "default") return packageSlug;
  const variantSlug = sanitizeSegment(variant, "variant");
  return `${packageSlug}-${variantSlug}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const sortedEntries = Object.entries(value as Record<string, unknown>).sort(
    ([left], [right]) => left.localeCompare(right),
  );
  return `{${sortedEntries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

function reserveNamespace(
  store: PresetRegistryStore,
  preferred: string,
  fallbackPrefix: string,
): string {
  if (!store.usedNamespaces.has(preferred)) {
    store.usedNamespaces.add(preferred);
    return preferred;
  }

  let suffix = 2;
  while (true) {
    const candidate = `${fallbackPrefix}-${suffix}`;
    if (!store.usedNamespaces.has(candidate)) {
      store.usedNamespaces.add(candidate);
      return candidate;
    }
    suffix += 1;
  }
}

function createFingerprint(options: UniversaPresetOptions): string {
  return stableStringify({
    identity: options.identity,
    composition: options.composition,
    instanceId: options.instanceId,
    unsafeOverrides: options.unsafeOverrides,
    options: options,
  });
}

function buildEffectiveOptions(
  options: UniversaPresetOptions,
  namespaceId: string,
  canonicalIdentity: string,
): UniversaAdapterOptions {
  const {
    identity: _identity,
    composition: _composition,
    instanceId: _instanceId,
    unsafeOverrides,
    ...adapterBaseOptions
  } = options;

  const defaultBridgePathPrefix = `${BRIDGE_PATH_PREFIX}/${namespaceId}`;
  const defaultRewriteSource = `${defaultBridgePathPrefix}/:path*`;
  const defaultAdapterName = `${ADAPTER_PREFIX}-${namespaceId}`;
  const defaultNextBridgeGlobalKey = `${NEXT_BRIDGE_GLOBAL_KEY_PREFIX}${namespaceId}`;

  return {
    ...adapterBaseOptions,
    bridgePathPrefix: defaultBridgePathPrefix,
    rewriteSource: defaultRewriteSource,
    adapterName: unsafeOverrides?.adapterName ?? defaultAdapterName,
    nextBridgeGlobalKey:
      unsafeOverrides?.nextBridgeGlobalKey ?? defaultNextBridgeGlobalKey,
    instance: {
      id: namespaceId,
      label: canonicalIdentity,
    },
  };
}

export function registerUniversaPreset(
  options: UniversaPresetOptions,
): UniversaPresetRegistration {
  const store = getRegistryStore();
  const fingerprint = createFingerprint(options);
  const existing = store.byFingerprint.get(fingerprint);
  if (existing) return existing;

  const identity = canonicalizeIdentity(options.identity);
  const baseId = createBaseId(identity.packageName, identity.variant);

  const explicitInstance = options.instanceId?.trim()
    ? sanitizeSegment(options.instanceId, "instance")
    : undefined;

  const count = (store.baseIdCounts.get(baseId) ?? 0) + 1;
  store.baseIdCounts.set(baseId, count);

  const namespaceCandidate = explicitInstance
    ? `${baseId}-${explicitInstance}`
    : count === 1
      ? baseId
      : `${baseId}-${count}`;

  const namespaceId = reserveNamespace(store, namespaceCandidate, baseId);
  const registrationId = `universa-preset-${store.nextOrder + 1}`;
  const composition = options.composition ?? "registry";
  const namespace: UniversaNamespaceMetadata = {
    canonicalIdentity: identity.canonicalIdentity,
    baseId,
    namespaceId,
    keyPrefix: `universa:client:${namespaceId}`,
  };

  const effectiveOptions = buildEffectiveOptions(
    options,
    namespaceId,
    identity.canonicalIdentity,
  );

  const registration: UniversaPresetRegistration = {
    id: registrationId,
    order: store.nextOrder + 1,
    fingerprint,
    identity: {
      packageName: identity.packageName,
      ...(identity.variant ? { variant: identity.variant } : {}),
    },
    composition,
    namespace,
    effectiveOptions,
  };

  store.entries.push(registration);
  store.byFingerprint.set(fingerprint, registration);
  store.nextOrder += 1;
  return registration;
}

export function getUniversaRegisteredPresets(): UniversaPresetRegistration[] {
  return [...getRegistryStore().entries];
}

function dedupeByNamespace(
  entries: UniversaPresetRegistration[],
): UniversaPresetRegistration[] {
  const byNamespace = new Map<string, UniversaPresetRegistration>();
  for (const entry of entries) {
    const namespaceId = entry.namespace.namespaceId;
    const existing = byNamespace.get(namespaceId);
    if (!existing || entry.order < existing.order) {
      byNamespace.set(namespaceId, entry);
    }
  }
  return [...byNamespace.values()].sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order;
    return left.namespace.namespaceId.localeCompare(
      right.namespace.namespaceId,
    );
  });
}

export function resolveFrameworkComposition(
  current: UniversaPresetRegistration,
): UniversaPresetRegistration[] {
  if (current.composition === "local") {
    return [current];
  }

  const registryEntries = getUniversaRegisteredPresets().filter(
    (entry) => entry.composition === "registry",
  );
  return dedupeByNamespace(registryEntries);
}
