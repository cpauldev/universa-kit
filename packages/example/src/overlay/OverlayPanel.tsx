import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Cpu,
  File,
  FileCode2,
  FileJson2,
  FileText,
  FolderOpen,
  Info,
  LoaderCircle,
  type LucideIcon,
  Play,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Square,
} from "lucide-react";
import * as React from "react";

import {
  type DashboardActionId,
  type DashboardActionState,
  type DashboardControlsSection,
  type DashboardLiveState,
  type DashboardTableCell,
  type DashboardTableSection,
  type DashboardTransportState,
  type DashboardWebSocketSnapshot,
  buildRuntimeSections,
} from "../dashboard/index.js";
import { OVERLAY_POSITIONS, TABS } from "./constants.js";
import { formatBytes, formatDate } from "./format.js";
import type {
  FileMetadata,
  OverlayAction,
  OverlaySettings,
  OverlaySeverity,
  OverlayState,
  OverlayTab,
  OverlayTheme,
  TabDefinition,
} from "./types.js";
import { Badge } from "./ui/badge.js";
import { Button } from "./ui/button.js";
import { Checkbox } from "./ui/checkbox.js";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty.js";
import { FileTree, filterFileTree } from "./ui/file-tree.js";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "./ui/input-group.js";
import { ScrollArea } from "./ui/scroll-area.js";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "./ui/select.js";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar.js";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip.js";
import { cn } from "./ui/utils.js";

// ── Status helpers ────────────────────────────────────────────────────────────

interface StatusCopy {
  title: string;
  detail: string;
}

function resolveOverlaySeverity(state: OverlayState): OverlaySeverity {
  if (state.errorMessage) return "error";
  if (state.transportState === "degraded") return "error";
  if (
    (state.transportState === "bridge_detecting" ||
      state.transportState === "runtime_starting") &&
    state.hasBootstrapped
  ) {
    return "loading";
  }
  if (!state.connected && state.hasBootstrapped) return "error";
  if (state.loadingAction) return "loading";

  const phase = state.bridgeState?.runtime.phase;
  if (phase === "running") return "success";
  if (phase === "error") return "error";
  if (phase === "starting" || phase === "stopping") return "loading";
  return "info";
}

function resolveStatusCopy(state: OverlayState): StatusCopy {
  const severity = resolveOverlaySeverity(state);
  const fallbackCommand =
    state.bridgeState?.capabilities?.fallbackCommand || "example dev";

  if (severity === "error") {
    if (state.transportState === "degraded") {
      return {
        title: "Runtime Unavailable",
        detail: `Start the runtime with \`${fallbackCommand}\``,
      };
    }
    if (!state.connected) {
      return {
        title: "Disconnected",
        detail: state.errorMessage || "Dev server unavailable",
      };
    }
    return {
      title: "Error",
      detail: state.errorMessage || "Unexpected overlay error",
    };
  }

  if (severity === "loading") {
    if (state.transportState === "bridge_detecting") {
      return {
        title: "Detecting Bridge",
        detail: "Checking for example bridge",
      };
    }
    if (state.transportState === "runtime_starting") {
      return {
        title: "Starting Runtime",
        detail: "Booting the example runtime",
      };
    }
    return { title: state.loadingAction ?? "Working", detail: "Processing..." };
  }

  if (severity === "success") {
    return { title: "Running", detail: "Runtime is active" };
  }

  if (state.bridgeState?.runtime.phase === "stopped") {
    return { title: "Stopped", detail: "Runtime is not running" };
  }
  return { title: "Connected", detail: "Example overlay active" };
}

// ─────────────────────────────────────────────────────────────────────────────

const TAB_ICONS: Record<string, LucideIcon> = {
  cpu: Cpu,
  "folder-open": FolderOpen,
  "sliders-horizontal": SlidersHorizontal,
};

const SEVERITY_ICONS: Record<OverlaySeverity, LucideIcon> = {
  success: CircleCheck,
  loading: LoaderCircle,
  error: CircleX,
  warning: CircleAlert,
  action: ArrowRight,
  info: Info,
};

const FILE_TYPE_ICONS: Record<
  string,
  { icon: LucideIcon; colorClass: string }
> = {
  tsx: { icon: FileCode2, colorClass: "text-cyan-600 dark:text-cyan-400" },
  jsx: { icon: FileCode2, colorClass: "text-cyan-600 dark:text-cyan-400" },
  ts: { icon: FileCode2, colorClass: "text-blue-600 dark:text-blue-400" },
  js: { icon: FileCode2, colorClass: "text-yellow-600 dark:text-yellow-400" },
  mjs: { icon: FileCode2, colorClass: "text-yellow-600 dark:text-yellow-400" },
  cjs: { icon: FileCode2, colorClass: "text-yellow-600 dark:text-yellow-400" },
  vue: { icon: FileCode2, colorClass: "text-green-600 dark:text-green-400" },
  svelte: {
    icon: FileCode2,
    colorClass: "text-orange-600 dark:text-orange-400",
  },
  astro: {
    icon: FileCode2,
    colorClass: "text-orange-600 dark:text-orange-400",
  },
  json: { icon: FileJson2, colorClass: "text-yellow-600 dark:text-yellow-400" },
  jsonc: {
    icon: FileJson2,
    colorClass: "text-yellow-600 dark:text-yellow-400",
  },
  md: { icon: FileText, colorClass: "text-zinc-500 dark:text-zinc-400" },
  mdx: { icon: FileText, colorClass: "text-violet-600 dark:text-violet-400" },
  html: { icon: FileCode2, colorClass: "text-orange-600 dark:text-orange-400" },
};

const DEFAULT_FILE_TYPE_ICON = {
  icon: File,
  colorClass: "text-muted-foreground",
};

export function normalizeTheme(theme: OverlayTheme): "light" | "dark" {
  if (theme === "light" || theme === "dark") return theme;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "dark";
}

function severityToBadgeVariant(
  severity: OverlaySeverity,
): "error" | "warning" | "success" | "info" | "secondary" {
  switch (severity) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "success":
      return "success";
    case "info":
      return "info";
    default:
      return "secondary";
  }
}

function formatPositionLabel(value: string): string {
  return value
    .split("-")
    .map((part) => (part[0]?.toUpperCase() ?? "") + part.slice(1))
    .join(" ");
}

function SeverityIcon({ severity }: { severity: OverlaySeverity }) {
  const Icon = SEVERITY_ICONS[severity] ?? Info;
  return (
    <Icon
      aria-hidden="true"
      className={cn("size-3.5", severity === "loading" && "animate-spin")}
    />
  );
}

type KvBadgeVariant =
  | "success"
  | "error"
  | "warning"
  | "secondary"
  | "default"
  | "info";

function resolveFilesEmptyMessage(state: OverlayState): string {
  if (!state.hasBootstrapped) {
    return "Connecting to bridge…";
  }

  if (state.transportState === "bridge_detecting") {
    return "Detecting bridge connection…";
  }

  if (state.transportState === "runtime_starting") {
    return "Runtime is starting. Files will appear when ready.";
  }

  if (
    state.transportState === "disconnected" ||
    state.transportState === "degraded" ||
    !state.connected
  ) {
    return state.errorMessage
      ? `Connection unavailable: ${state.errorMessage}`
      : "Connection unavailable. Files cannot be loaded.";
  }

  return "No files found.";
}

function resolveDashboardActionLoading(
  loadingAction: string | null,
): DashboardActionId | null {
  if (loadingAction === "Starting") return "start";
  if (loadingAction === "Restarting") return "restart";
  if (loadingAction === "Stopping") return "stop";
  return null;
}

function toDashboardLiveState(state: OverlayState): DashboardLiveState {
  return {
    hasBootstrapped: state.hasBootstrapped,
    connected: state.connected,
    transportState: state.transportState as DashboardTransportState,
    bridgeState: state.bridgeState,
    errorMessage: state.errorMessage,
    lastUpdatedAt: state.lastSuccessAt,
    consecutiveFailures: 0,
    fallbackCommand:
      state.bridgeState?.capabilities?.fallbackCommand ?? "example dev",
    protocolVersion: state.bridgeState?.protocolVersion ?? null,
  };
}

function toDashboardWebSocketSnapshot(input: {
  wsConnected: boolean;
  wsOpenedAt: number | null;
  wsFallbackMode: boolean;
  wsConsecutiveFailures: number;
}): DashboardWebSocketSnapshot {
  return {
    status: input.wsConnected ? "open" : "closed",
    openedAt: input.wsOpenedAt,
    mode: input.wsFallbackMode ? "polling" : "websocket",
    failures: input.wsConsecutiveFailures,
  };
}

function resolveToneClassName(
  tone: "default" | "muted" | "code" | undefined,
): string {
  if (tone === "muted") {
    return "break-words text-muted-foreground";
  }
  if (tone === "code") {
    return "break-words font-mono text-[11px]";
  }
  return "break-words";
}

function toKvRowValueProps(value: DashboardTableCell): {
  value: string;
  badgeVariant?: KvBadgeVariant;
  href?: string;
  tone?: "default" | "muted" | "code";
} {
  if (value.kind === "badge") {
    return { value: value.text, badgeVariant: value.variant };
  }

  if (value.kind === "link") {
    return {
      value: value.text,
      href: value.href,
      tone: value.tone,
    };
  }

  return {
    value: value.text,
    tone: value.tone,
  };
}

function KvRow({
  label,
  value,
  badgeVariant,
  href,
  tone,
}: {
  label: string;
  value: string;
  badgeVariant?: KvBadgeVariant;
  href?: string;
  tone?: "default" | "muted" | "code";
}) {
  return (
    <div className="overlay-kv-row text-xs leading-[1.35]">
      <span className="text-muted-foreground">{label}</span>
      {badgeVariant !== undefined ? (
        <Badge variant={badgeVariant} size="sm" className="justify-self-start">
          {value || "n/a"}
        </Badge>
      ) : href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className={cn(
            "inline-flex min-w-0 items-center gap-1 text-primary hover:underline",
            resolveToneClassName(tone),
          )}
        >
          {value || "n/a"}
          <ArrowUpRight aria-hidden="true" size={12} />
        </a>
      ) : (
        <span className={resolveToneClassName(tone)}>{value || "n/a"}</span>
      )}
    </div>
  );
}

function TabIcon({ name }: { name: string }) {
  const Icon = TAB_ICONS[name] ?? File;
  return <Icon aria-hidden="true" />;
}

interface TabButtonProps {
  tab: TabDefinition;
  isActive: boolean;
  mode: "sidebar" | "toolbar";
  onSelect: (tab: OverlayTab) => void;
}

function TabButton({ tab, isActive, mode, onSelect }: TabButtonProps) {
  const id =
    mode === "sidebar"
      ? `overlay-tab-${tab.id}`
      : `overlay-tab-${tab.id}-toolbar`;
  const tabIndex = TABS.findIndex((candidate) => candidate.id === tab.id);

  const focusTabByIndex = (nextIndex: number) => {
    const nextTab = TABS[nextIndex];
    if (!nextTab) return;

    onSelect(nextTab.id as OverlayTab);

    const nextId =
      mode === "sidebar"
        ? `overlay-tab-${nextTab.id}`
        : `overlay-tab-${nextTab.id}-toolbar`;

    requestAnimationFrame(() => {
      document.getElementById(nextId)?.focus();
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const isVertical = mode === "sidebar";
    const lastIndex = TABS.length - 1;

    switch (event.key) {
      case "ArrowDown":
        if (!isVertical) return;
        event.preventDefault();
        focusTabByIndex(tabIndex === lastIndex ? 0 : tabIndex + 1);
        return;
      case "ArrowUp":
        if (!isVertical) return;
        event.preventDefault();
        focusTabByIndex(tabIndex === 0 ? lastIndex : tabIndex - 1);
        return;
      case "ArrowRight":
        if (isVertical) return;
        event.preventDefault();
        focusTabByIndex(tabIndex === lastIndex ? 0 : tabIndex + 1);
        return;
      case "ArrowLeft":
        if (isVertical) return;
        event.preventDefault();
        focusTabByIndex(tabIndex === 0 ? lastIndex : tabIndex - 1);
        return;
      case "Home":
        event.preventDefault();
        focusTabByIndex(0);
        return;
      case "End":
        event.preventDefault();
        focusTabByIndex(lastIndex);
        return;
      default:
        return;
    }
  };

  return (
    <SidebarMenuButton
      id={id}
      role="tab"
      aria-selected={isActive}
      aria-controls="overlay-panel"
      tabIndex={0}
      className={cn("min-w-0", mode === "toolbar" && "px-2")}
      isActive={isActive}
      onClick={() => onSelect(tab.id as OverlayTab)}
      onKeyDown={handleKeyDown}
      {...(mode === "toolbar" ? { "aria-label": tab.label } : {})}
    >
      <TabIcon name={tab.icon} />
      {mode === "sidebar" && <span>{tab.label}</span>}
    </SidebarMenuButton>
  );
}

interface TopbarProps {
  severity: OverlaySeverity;
  statusTitle: string;
}

function Topbar({ severity, statusTitle }: TopbarProps) {
  return (
    <div className="overlay-header">
      <div className="overlay-header-title">
        <span className="overlay-header-label">Example</span>
      </div>
      <Badge
        variant={severityToBadgeVariant(severity)}
        role="status"
        aria-live="polite"
        data-topbar-badge=""
      >
        <SeverityIcon severity={severity} />
        {statusTitle}
      </Badge>
    </div>
  );
}

function Toolbar({
  activeTab,
  onSelectTab,
}: {
  activeTab: OverlayTab;
  onSelectTab: (tab: OverlayTab) => void;
}) {
  return (
    <SidebarMenu
      className="overlay-toolbar"
      role="tablist"
      aria-label="Example overlay tabs"
      aria-orientation="horizontal"
    >
      {TABS.map((tab) => (
        <SidebarMenuItem key={tab.id} className="shrink-0">
          <TabButton
            tab={tab}
            isActive={activeTab === tab.id}
            mode="toolbar"
            onSelect={onSelectTab}
          />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function SidebarNav({
  activeTab,
  onSelectTab,
}: {
  activeTab: OverlayTab;
  onSelectTab: (tab: OverlayTab) => void;
}) {
  return (
    <aside className="overlay-sidebar">
      <ScrollArea className="overlay-sidebar-scroll">
        <SidebarMenu
          className="overlay-nav-tabs"
          aria-label="Example overlay tabs"
          role="tablist"
          aria-orientation="vertical"
        >
          {TABS.map((tab) => (
            <SidebarMenuItem key={tab.id}>
              <TabButton
                tab={tab}
                isActive={activeTab === tab.id}
                mode="sidebar"
                onSelect={onSelectTab}
              />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </ScrollArea>
    </aside>
  );
}

interface WorkspaceSidebarProps {
  state: OverlayState;
  onDispatch: (action: OverlayAction) => void;
  onLoadFileMetadata: (path: string) => void;
}

function WorkspaceSidebar({
  state,
  onDispatch,
  onLoadFileMetadata,
}: WorkspaceSidebarProps) {
  const q = state.fileFilter.trim();
  const filteredResult = q ? filterFileTree(state.fileTree, q) : null;
  const displayNodes = filteredResult?.nodes ?? state.fileTree;
  const forceExpand = filteredResult?.forceExpand;
  const showFilterEmpty =
    q.length > 0 && state.fileTree.length > 0 && displayNodes.length === 0;

  return (
    <aside className="overlay-sidebar overlay-sidebar--workspace">
      <nav
        className="overlay-nav-tabs overlay-nav-tabs--workspace"
        aria-label="Example overlay files navigation"
        role="tablist"
        aria-orientation="vertical"
      >
        <div className="overlay-workspace-nav">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="max-sm:hidden"
                  aria-label="Back to Runtime"
                  role="tab"
                  aria-selected={false}
                  aria-controls="overlay-panel"
                />
              }
              onClick={() => onDispatch({ type: "setTab", tab: "runtime" })}
            >
              <ArrowLeft aria-hidden="true" size={14} />
            </TooltipTrigger>
            <TooltipPopup side="right">Back to Runtime</TooltipPopup>
          </Tooltip>
          <SidebarMenuButton
            className="min-w-0 cursor-default justify-start disabled:pointer-events-none disabled:opacity-100 aria-disabled:opacity-100"
            disabled
            aria-disabled="true"
            tabIndex={-1}
            isActive
          >
            <FolderOpen aria-hidden="true" />
            <span>Files</span>
          </SidebarMenuButton>
        </div>
        <div className="overlay-workspace-search">
          <InputGroup>
            <InputGroupAddon aria-hidden="true">
              <Search className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={state.fileFilter}
              placeholder="Search files"
              aria-label="Search files"
              onChange={(e) =>
                onDispatch({
                  type: "setFileFilter",
                  fileFilter: e.target.value,
                })
              }
            />
          </InputGroup>
        </div>
      </nav>
      <ScrollArea className="overlay-sidebar-scroll">
        <div className="overlay-workspace-content">
          {state.treeLoading && state.fileTree.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              Loading…
            </p>
          ) : state.fileTree.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              {resolveFilesEmptyMessage(state)}
            </p>
          ) : showFilterEmpty ? (
            <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              No files match your search.
            </p>
          ) : (
            <FileTree
              nodes={displayNodes}
              selectedPath={state.selectedFilePath}
              forceExpand={forceExpand}
              onFileClick={(path) => {
                onDispatch({ type: "setSelectedFilePath", path });
                onLoadFileMetadata(path);
              }}
              fileIconRenderer={(node) => <FileTypeIcon path={node.path} />}
            />
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

function FileMetadataPanel({
  meta,
  onOpenFile,
}: {
  meta: FileMetadata;
  onOpenFile: (path: string) => void;
}) {
  return (
    <div className="overlay-file-details">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1.5 break-all text-sm font-semibold">
          <FileTypeIcon path={meta.path} />
          {meta.name}
        </p>
        <Button
          variant="outline"
          className="shrink-0"
          onClick={() => onOpenFile(meta.path)}
        >
          Open in editor
          <ArrowUpRight aria-hidden="true" size={14} />
        </Button>
      </div>
      <div className="overlay-section">
        <h4 className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Metadata
        </h4>
        <div className="overlay-kv-grid">
          <KvRow label="Name" value={meta.name} />
          <KvRow label="Path" value={meta.path} />
          {meta.absolutePath && (
            <KvRow label="Full path" value={meta.absolutePath} />
          )}
          <KvRow
            label="Type"
            value={meta.isDirectory ? "Directory" : meta.extension || "File"}
          />
          <KvRow label="Size" value={formatBytes(meta.size)} />
          {meta.lines !== undefined && (
            <KvRow label="Lines" value={meta.lines.toLocaleString()} />
          )}
          <KvRow label="Modified" value={formatDate(meta.modified)} />
          <KvRow label="Created" value={formatDate(meta.created)} />
        </div>
      </div>
    </div>
  );
}

function FileTypeIcon({ path }: { path: string }) {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  const entry = FILE_TYPE_ICONS[extension] ?? DEFAULT_FILE_TYPE_ICON;
  const Icon = entry.icon;
  return (
    <Icon
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", entry.colorClass)}
    />
  );
}

function FilesPane({
  state,
  onOpenFile,
}: {
  state: OverlayState;
  onOpenFile: (path: string) => void;
}) {
  if (state.selectedFilePath && state.fileMetadata) {
    return (
      <section className="overlay-pane">
        <FileMetadataPanel meta={state.fileMetadata} onOpenFile={onOpenFile} />
      </section>
    );
  }
  if (state.selectedFilePath && state.fileMetadataLoading) {
    return (
      <section className="overlay-pane">
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Loading…
        </p>
      </section>
    );
  }
  return (
    <section className="overlay-pane overlay-pane--empty">
      <Empty className="h-full border-0 p-6 md:p-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText aria-hidden="true" size={18} />
          </EmptyMedia>
          <EmptyTitle>Select a file</EmptyTitle>
          <EmptyDescription>
            Choose a file from the left panel to view details.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </section>
  );
}

interface SettingsPaneProps {
  state: OverlayState;
  onDispatch: (action: OverlayAction) => void;
}

function SettingsPane({ state, onDispatch }: SettingsPaneProps) {
  const settings = state.settings;

  const applySettings = (next: OverlaySettings) =>
    onDispatch({ type: "setSettings", settings: next });

  return (
    <section className="overlay-pane">
      <section className="overlay-section">
        <h4 className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Behavior
        </h4>
        <div className="overlay-settings-row">
          <label
            className="text-sm leading-[1.35]"
            htmlFor="overlay-auto-expand"
          >
            Expand on hover
          </label>
          <Checkbox
            id="overlay-auto-expand"
            checked={settings.autoExpand}
            onCheckedChange={(checked) =>
              applySettings({ ...settings, autoExpand: Boolean(checked) })
            }
            aria-label="Expand on hover"
          />
        </div>
      </section>
      <section className="overlay-section">
        <h4 className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Appearance
        </h4>
        <div className="overlay-settings-row">
          <label className="text-sm leading-[1.35]">Theme</label>
          <Select
            value={settings.theme}
            onValueChange={(value) =>
              value &&
              applySettings({
                ...settings,
                theme: value as OverlaySettings["theme"],
              })
            }
          >
            <SelectTrigger className="w-auto">
              <SelectValue>
                {(settings.theme[0]?.toUpperCase() ?? "") +
                  settings.theme.slice(1)}
              </SelectValue>
            </SelectTrigger>
            <SelectPopup alignItemWithTrigger={false}>
              {(["system", "light", "dark"] as const).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {(opt[0]?.toUpperCase() ?? "") + opt.slice(1)}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
        <div className="overlay-settings-row">
          <label className="text-sm leading-[1.35]">Position</label>
          <Select
            value={settings.position}
            onValueChange={(value) =>
              value &&
              applySettings({
                ...settings,
                position: value as OverlaySettings["position"],
              })
            }
          >
            <SelectTrigger className="w-auto">
              <SelectValue>
                {formatPositionLabel(settings.position)}
              </SelectValue>
            </SelectTrigger>
            <SelectPopup alignItemWithTrigger={false}>
              {OVERLAY_POSITIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {formatPositionLabel(opt)}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
      </section>
    </section>
  );
}

interface RuntimePaneProps {
  state: OverlayState;
  wsConnected: boolean;
  wsOpenedAt: number | null;
  wsFallbackMode: boolean;
  wsConsecutiveFailures: number;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
}

function resolveRuntimeActionHandler(
  action: DashboardActionState,
  handlers: {
    onStart: () => void;
    onStop: () => void;
    onRestart: () => void;
  },
): () => void {
  if (action.id === "start") return handlers.onStart;
  if (action.id === "restart") return handlers.onRestart;
  return handlers.onStop;
}

function RuntimeActionIcon({ actionId }: { actionId: DashboardActionId }) {
  if (actionId === "start") {
    return <Play aria-hidden="true" size={14} />;
  }
  if (actionId === "restart") {
    return <RotateCcw aria-hidden="true" size={14} />;
  }
  return <Square aria-hidden="true" size={14} />;
}

function RuntimePane({
  state,
  wsConnected,
  wsOpenedAt,
  wsFallbackMode,
  wsConsecutiveFailures,
  onStart,
  onStop,
  onRestart,
}: RuntimePaneProps) {
  const runtimeData = buildRuntimeSections({
    live: toDashboardLiveState(state),
    websocket: toDashboardWebSocketSnapshot({
      wsConnected,
      wsOpenedAt,
      wsFallbackMode,
      wsConsecutiveFailures,
    }),
    actionLoading: resolveDashboardActionLoading(state.loadingAction),
  });

  const controlsSection = runtimeData.sections.find(
    (section): section is DashboardControlsSection => section.id === "controls",
  );
  const runtimeSections = runtimeData.sections.filter(
    (section): section is DashboardTableSection => section.id !== "controls",
  );

  return (
    <div className="overlay-pane">
      <div className="overlay-section">
        <h4 className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Controls
        </h4>
        <div className="overlay-actions">
          {(controlsSection?.actions ?? []).map((action) => (
            <Button
              key={action.id}
              variant={
                action.disabled || action.loading ? "secondary" : "outline"
              }
              disabled={action.disabled}
              onClick={resolveRuntimeActionHandler(action, {
                onStart,
                onStop,
                onRestart,
              })}
            >
              <RuntimeActionIcon actionId={action.id} />
              {action.loading ? action.loadingLabel : action.label}
            </Button>
          ))}
        </div>
        {controlsSection?.message && (
          <p className="text-xs leading-[1.4] text-muted-foreground">
            {controlsSection.message}
          </p>
        )}
      </div>

      <div className="overlay-runtime-columns">
        {runtimeSections.map((section) => (
          <div key={section.id} className="overlay-runtime-column">
            <h4 className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              {section.title}
            </h4>
            <div className="overlay-kv-grid">
              {section.rows.map((row) => (
                <KvRow
                  key={row.key}
                  label={row.label}
                  {...toKvRowValueProps(row.value)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface OverlayPanelProps {
  state: OverlayState;
  wsConnected: boolean;
  wsOpenedAt: number | null;
  wsFallbackMode: boolean;
  wsConsecutiveFailures: number;
  onDispatch: (action: OverlayAction) => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onLoadFileMetadata: (path: string) => void;
  onOpenFile: (path: string) => void;
  onEnsureFileTreeLoaded: () => void;
}

export function OverlayPanel({
  state,
  wsConnected,
  wsOpenedAt,
  wsFallbackMode,
  wsConsecutiveFailures,
  onDispatch,
  onStart,
  onStop,
  onRestart,
  onLoadFileMetadata,
  onOpenFile,
  onEnsureFileTreeLoaded,
}: OverlayPanelProps) {
  const theme = normalizeTheme(state.settings.theme);
  const severity = resolveOverlaySeverity(state);
  const statusCopy = resolveStatusCopy(state);
  const useWorkspaceSidebar = state.activeTab === "files";

  const selectTab = (tab: OverlayTab) => {
    onDispatch({ type: "setTab", tab });
    if (tab === "files") onEnsureFileTreeLoaded();
  };

  const renderActivePane = () => {
    switch (state.activeTab) {
      case "runtime":
        return (
          <RuntimePane
            state={state}
            wsConnected={wsConnected}
            wsOpenedAt={wsOpenedAt}
            wsFallbackMode={wsFallbackMode}
            wsConsecutiveFailures={wsConsecutiveFailures}
            onStart={onStart}
            onStop={onStop}
            onRestart={onRestart}
          />
        );
      case "files":
        return <FilesPane state={state} onOpenFile={onOpenFile} />;
      case "settings":
        return <SettingsPane state={state} onDispatch={onDispatch} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="overlay-shell overlay-root"
      data-role="overlay-shell"
      data-theme={theme}
      data-severity={severity}
      {...(useWorkspaceSidebar ? { "data-workspace-sidebar": "true" } : {})}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <Topbar severity={severity} statusTitle={statusCopy.title} />
      <Toolbar activeTab={state.activeTab} onSelectTab={selectTab} />
      <div className="overlay-layout" data-role="overlay-layout">
        {useWorkspaceSidebar ? (
          <WorkspaceSidebar
            state={state}
            onDispatch={onDispatch}
            onLoadFileMetadata={onLoadFileMetadata}
          />
        ) : (
          <SidebarNav activeTab={state.activeTab} onSelectTab={selectTab} />
        )}
        <section className="overlay-main" data-role="overlay-main">
          <ScrollArea
            key={state.activeTab}
            className="overlay-body"
            id="overlay-panel"
            role="tabpanel"
          >
            {renderActivePane()}
          </ScrollArea>
        </section>
      </div>
    </div>
  );
}
