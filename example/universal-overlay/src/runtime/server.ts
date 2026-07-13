#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { extname, join, normalize, relative, resolve, sep } from "path";

const PORT = Number(
  process.env[
    process.env.UNIVERSAL_OVERLAY_RUNTIME_PORT ??
      "UNIVERSAL_OVERLAY_RUNTIME_PORT"
  ] ??
    process.env.UNIVERSAL_OVERLAY_RUNTIME_PORT ??
    0,
);

const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".astro",
  ".output",
  ".vercel",
  ".netlify",
  "coverage",
]);
const PROJECT_ROOT = resolve(process.cwd());

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

export interface FileMetadata {
  name: string;
  path: string;
  absolutePath: string;
  size: number;
  extension: string;
  isDirectory: boolean;
  modified: number;
  created: number;
  lines?: number;
}

function buildFileTree(dirPath: string, rootPath: string): FileTreeNode[] {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;

    const fullPath = join(dirPath, entry.name);
    const relativePath = relative(rootPath, fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: "directory" as const,
        children: buildFileTree(fullPath, rootPath),
      });
    } else {
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: "file" as const,
      });
    }
  }

  return nodes.sort((a, b) => {
    const aIsDir = a.type === "directory";
    const bIsDir = b.type === "directory";
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function resolveSafePath(relPath: string): string | null {
  const normalized = normalize(relPath).replace(/^([/\\])+/, "");
  const absolute = resolve(PROJECT_ROOT, normalized);
  if (!absolute.startsWith(PROJECT_ROOT + sep) && absolute !== PROJECT_ROOT) {
    return null;
  }
  return absolute;
}

function parseLine(line: string | null): number | null {
  if (!line) return 0;
  const parsed = Number.parseInt(line, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000) {
    return null;
  }
  return parsed;
}

function spawnBestEffort(cmd: string[]): boolean {
  try {
    Bun.spawn({
      cmd,
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function openFileInEditor(safePath: string, lineNumber = 0): void {
  const lineArg = lineNumber > 0 ? `${safePath}:${lineNumber}` : safePath;

  if (spawnBestEffort(["code", "--goto", lineArg])) {
    return;
  }

  if (process.platform === "win32") {
    spawnBestEffort(["cmd", "/c", "start", "", safePath]);
    return;
  }

  if (process.platform === "darwin") {
    spawnBestEffort(["open", safePath]);
    return;
  }

  spawnBestEffort(["xdg-open", safePath]);
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

const server = Bun.serve({
  port: PORT || 0,
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (pathname === "/api/version") {
      return json({ version: "1.0.0", status: "running" });
    }

    if (pathname === "/api/files") {
      const tree = buildFileTree(PROJECT_ROOT, PROJECT_ROOT);
      return json(tree);
    }

    if (pathname.startsWith("/api/files/")) {
      const filePath = decodeURIComponent(pathname.slice("/api/files/".length));
      const fullPath = resolveSafePath(filePath);

      if (!fullPath) {
        return json({ error: "Access denied" }, 403);
      }

      if (!existsSync(fullPath)) {
        return json({ error: "Not found" }, 404);
      }

      const stat = statSync(fullPath);
      const isDirectory = stat.isDirectory();
      const extension = extname(filePath).toLowerCase();
      const TEXT_EXTENSIONS = new Set([
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".mjs",
        ".cjs",
        ".vue",
        ".svelte",
        ".astro",
        ".json",
        ".jsonc",
        ".yaml",
        ".yml",
        ".toml",
        ".md",
        ".mdx",
        ".html",
        ".css",
        ".scss",
        ".sass",
        ".less",
        ".txt",
        ".sh",
        ".bash",
        ".env",
        ".gitignore",
      ]);

      let lines: number | undefined;
      if (!isDirectory && (TEXT_EXTENSIONS.has(extension) || !extension)) {
        try {
          const content = readFileSync(fullPath, "utf-8");
          lines = content.split("\n").length;
        } catch {
          // Binary or unreadable file — skip
        }
      }

      const meta: FileMetadata = {
        name: filePath.split("/").pop() ?? filePath,
        path: filePath,
        absolutePath: fullPath,
        size: stat.size,
        extension,
        isDirectory,
        modified: stat.mtimeMs,
        created: stat.birthtimeMs,
        lines,
      };
      return json(meta);
    }

    if (pathname === "/api/open-file") {
      const filePath = url.searchParams.get("path");
      if (!filePath) {
        return json({ error: "Missing path parameter" }, 400);
      }

      const safePath = resolveSafePath(filePath);
      if (!safePath) {
        return json({ error: "Access denied" }, 403);
      }

      if (!existsSync(safePath)) {
        return json({ error: "Not found" }, 404);
      }

      const lineNumber = parseLine(url.searchParams.get("line"));
      if (lineNumber === null) {
        return json({ error: "Invalid line number" }, 400);
      }

      openFileInEditor(safePath, lineNumber);
      return json({ success: true });
    }

    return json({ error: "Not found" }, 404);
  },
});

console.warn(`Universal Overlay runtime listening on port ${server.port}`);
