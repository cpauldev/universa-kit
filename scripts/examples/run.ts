#!/usr/bin/env bun

import { type ChildProcess, exec, spawn } from "child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { createServer } from "net";
import { platform } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, "../..");
const EXAMPLES_RUN_LOCK_PATH = join(ROOT_DIR, ".tmp-examples-run.lock");
const PORT_RANGE_START = 4600;
const OUTPUT_TAIL_LINES = 25;
const READY_MARKERS = [
  "ready",
  "http://localhost",
  "started",
  "listening",
  "Ready in",
];
const ISSUE_MARKERS = ["ERROR", "error", "warn"];
const ERROR_MARKERS = ["ERROR", "Error", "error", "Unable to acquire lock"];
const NEXT_DEV_LOCK_PATHS = [
  join(".next", "dev", "lock"),
  join(".next", "lock"),
];

interface ExampleDefinition {
  id: string;
  name: string;
  dir: string;
  env?: Record<string, string>;
  devArgs?: string[];
  /** Poll the URL after the ready marker fires to confirm the app is actually serving. */
  confirmUrl?: boolean;
}

interface RuntimeExample extends ExampleDefinition {
  port: number;
  cwd: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

// Fixed port registry — each framework owns a stable, predictable port.
// Using PORT_RANGE_START + 1 so port 4600 remains free for the bridge manager.
const EXAMPLE_PORTS: Record<string, number> = {
  react: PORT_RANGE_START + 1,
  vue: PORT_RANGE_START + 2,
  sveltekit: PORT_RANGE_START + 3,
  solid: PORT_RANGE_START + 4,
  astro: PORT_RANGE_START + 5,
  nextjs: PORT_RANGE_START + 6,
  nuxt: PORT_RANGE_START + 7,
  vanilla: PORT_RANGE_START + 8,
  vinext: PORT_RANGE_START + 9,
};

const EXAMPLES: ExampleDefinition[] = [
  {
    id: "react",
    name: "React",
    dir: "react",
  },
  {
    id: "vue",
    name: "Vue",
    dir: "vue",
  },
  {
    id: "sveltekit",
    name: "SvelteKit",
    dir: "sveltekit",
  },
  {
    id: "solid",
    name: "Solid",
    dir: "solid",
  },
  {
    id: "astro",
    name: "Astro",
    dir: "astro",
  },
  {
    id: "nextjs",
    name: "Next.js",
    dir: "nextjs",
  },
  {
    id: "nuxt",
    name: "Nuxt",
    dir: "nuxt",
    // Nuxt fork mode restarts the worker on unhandled ECONNRESET in dev.
    // Non-fork mode keeps the server stable in multi-example runs.
    devArgs: ["--no-fork"],
  },
  {
    id: "vanilla",
    name: "Vanilla",
    dir: "vanilla",
  },
  {
    id: "vinext",
    name: "Vinext",
    dir: "vinext",
    // RSC request handler registers after Vite's socket is ready; poll to confirm.
    confirmUrl: true,
  },
];

const runningProcesses: ChildProcess[] = [];
let runLockHeld = false;

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
};

const EXAMPLE_COLORS = [
  COLORS.cyan,
  COLORS.green,
  COLORS.yellow,
  COLORS.blue,
  COLORS.magenta,
  COLORS.cyan,
];

function log(message: string, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function openInBrowser(url: string) {
  const os = platform();
  const command =
    os === "win32"
      ? `start ${url}`
      : os === "darwin"
        ? `open ${url}`
        : `xdg-open ${url}`;

  exec(command, (error) => {
    if (error) console.error(`Failed to open browser: ${error.message}`);
  });
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireRunLock(): void {
  if (existsSync(EXAMPLES_RUN_LOCK_PATH)) {
    try {
      const stalePid = Number.parseInt(
        String(JSON.parse(readFileSync(EXAMPLES_RUN_LOCK_PATH, "utf8"))?.pid),
        10,
      );
      if (
        Number.isFinite(stalePid) &&
        stalePid > 0 &&
        isProcessAlive(stalePid)
      ) {
        throw new Error(
          `examples runner is already active (pid ${stalePid}). Stop it before starting another.`,
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("already active")) {
        throw error;
      }
      // stale lock or invalid file format
    }
    try {
      unlinkSync(EXAMPLES_RUN_LOCK_PATH);
    } catch {
      // best effort
    }
  }

  writeFileSync(
    EXAMPLES_RUN_LOCK_PATH,
    JSON.stringify(
      {
        pid: process.pid,
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
  runLockHeld = true;
}

function releaseRunLock(): void {
  if (!runLockHeld) return;
  runLockHeld = false;
  try {
    unlinkSync(EXAMPLES_RUN_LOCK_PATH);
  } catch {
    // best effort
  }
}

function clearNextDevLocks(example: RuntimeExample) {
  if (example.id !== "nextjs") {
    return;
  }

  for (const relativePath of NEXT_DEV_LOCK_PATHS) {
    const lockPath = join(example.cwd, relativePath);
    try {
      if (existsSync(lockPath)) {
        unlinkSync(lockPath);
      }
    } catch {
      // Best-effort cleanup.
    }
  }
}

function includesAny(value: string, markers: string[]): boolean {
  return markers.some((marker) => value.includes(marker));
}

async function pollUntilServing(url: string, timeoutMs = 20000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      // "Cannot GET /" is Vite's fallback when no middleware handles the route.
      if (res.status !== 404) return;
      const body = await res.text();
      if (!body.includes("Cannot GET")) return;
    } catch {
      // Server not accepting connections yet — keep waiting.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
  });
}

function toRuntimeExample(
  definition: ExampleDefinition,
  resolvedPort: number,
): RuntimeExample {
  const extraArgs = definition.devArgs ?? [];
  return {
    ...definition,
    port: resolvedPort,
    cwd: join(ROOT_DIR, "examples", definition.dir),
    command: "bun",
    args: ["run", "dev", "--", "--port", String(resolvedPort), ...extraArgs],
    env: { PORT: String(resolvedPort), ...(definition.env ?? {}) },
  };
}

async function resolveRuntimeExamples(
  definitions: ExampleDefinition[],
): Promise<RuntimeExample[]> {
  const resolvedExamples: RuntimeExample[] = [];

  for (const definition of definitions) {
    const port = EXAMPLE_PORTS[definition.id];
    if (port === undefined) {
      throw new Error(
        `No port assigned for example "${definition.id}". Add it to EXAMPLE_PORTS.`,
      );
    }
    if (!(await isPortAvailable(port))) {
      throw new Error(
        `Port ${port} is already in use (assigned to ${definition.name}). Stop whatever is using it and try again.`,
      );
    }
    resolvedExamples.push(toRuntimeExample(definition, port));
  }

  return resolvedExamples;
}

function pushOutputTail(outputTail: string[], chunk: string) {
  const lines = chunk
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return;

  outputTail.push(...lines);
  if (outputTail.length > OUTPUT_TAIL_LINES) {
    outputTail.splice(0, outputTail.length - OUTPUT_TAIL_LINES);
  }
}

function printUsageAndExit() {
  log(
    `${COLORS.red}Error: No valid examples specified.${COLORS.reset}`,
    COLORS.red,
  );
  log(
    `\nAvailable examples: ${EXAMPLES.map((example) => example.id).join(", ")}\n`,
    COLORS.yellow,
  );
  log("Usage:", COLORS.bright);
  log("  bun run examples                    # Run all examples");
  log("  bun run examples react nextjs       # Run specific examples");
  log(
    "  bun run examples --no-open          # Run without opening browser tabs\n",
  );
  process.exit(1);
}

function parseArguments(argv: string[]): {
  openBrowser: boolean;
  selectedExamples: ExampleDefinition[];
} {
  const args = [...argv];
  let openBrowser = true;

  const noOpenIndex = args.indexOf("--no-open");
  if (noOpenIndex !== -1) {
    openBrowser = false;
    args.splice(noOpenIndex, 1);
  }

  if (args.length === 0) {
    return { openBrowser, selectedExamples: EXAMPLES };
  }

  const requestedIds = args.map((arg) => arg.toLowerCase());
  const selectedExamples = EXAMPLES.filter((example) =>
    requestedIds.includes(example.id),
  );

  if (selectedExamples.length === 0) {
    printUsageAndExit();
  }

  return { openBrowser, selectedExamples };
}

function killProcess(processHandle: ChildProcess): void {
  const pid = processHandle.pid;
  if (!pid) return;
  if (platform() === "win32") {
    // Kill the entire process tree on Windows so child processes
    // (e.g. Turbopack workers, HMR servers) don't outlive the runner.
    exec(`taskkill /F /T /PID ${pid}`, () => {});
  } else {
    processHandle.kill("SIGTERM");
  }
}

function cleanupAndExit(code = 0) {
  log("\n\nShutting down all servers...", COLORS.yellow);
  runningProcesses.forEach(killProcess);
  releaseRunLock();
  process.exit(code);
}

function startExample(
  example: RuntimeExample,
  index: number,
  openBrowser = true,
) {
  const color = EXAMPLE_COLORS[index % EXAMPLE_COLORS.length];
  const url = `http://localhost:${example.port}`;
  const outputTail: string[] = [];
  clearNextDevLocks(example);
  let hasShownReady = false;

  const childProcess = spawn(example.command, example.args, {
    cwd: example.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...example.env,
      FORCE_COLOR: "1",
    },
  });

  runningProcesses.push(childProcess);

  childProcess.stdout?.on("data", async (data) => {
    const output = data.toString();
    pushOutputTail(outputTail, output);

    if (!hasShownReady && includesAny(output, READY_MARKERS)) {
      hasShownReady = true;
      if (example.confirmUrl) {
        await pollUntilServing(url);
      }
      log(
        `${COLORS.green}✓${COLORS.reset} ${example.name.padEnd(12)} ${COLORS.bright}${url}${COLORS.reset}`,
      );
      if (openBrowser) openInBrowser(url);
    }

    if (includesAny(output, ISSUE_MARKERS)) {
      console.log(`${color}[${example.name}]${COLORS.reset} ${output.trim()}`);
    }
  });

  childProcess.stderr?.on("data", (data) => {
    const output = data.toString();
    pushOutputTail(outputTail, output);
    if (includesAny(output, ERROR_MARKERS)) {
      console.error(
        `${COLORS.red}[${example.name}]${COLORS.reset} ${output.trim()}`,
      );
    }
  });

  childProcess.on("error", (error) => {
    log(
      `${COLORS.red}✗${COLORS.reset} ${example.name} failed: ${error.message}`,
      COLORS.red,
    );
  });

  childProcess.on("close", (code) => {
    if (code !== 0 && code !== null) {
      log(
        `${COLORS.red}✗${COLORS.reset} ${example.name} exited with code ${code}`,
        COLORS.red,
      );

      if (outputTail.length > 0) {
        console.error(
          `${COLORS.red}[${example.name}]${COLORS.reset} Last output:\n${outputTail.join("\n")}`,
        );
      }
    }
  });
}

async function main() {
  acquireRunLock();
  const { openBrowser, selectedExamples } = parseArguments(
    process.argv.slice(2),
  );
  process.on("SIGINT", () => cleanupAndExit(0));
  process.on("SIGTERM", () => cleanupAndExit(0));

  log(
    `${COLORS.bright}Starting ${selectedExamples.length} example${selectedExamples.length > 1 ? "s" : ""}...${COLORS.reset}`,
    COLORS.cyan,
  );
  log(`${COLORS.yellow}Press Ctrl+C to stop all servers${COLORS.reset}\n`);

  const runtimeExamples = await resolveRuntimeExamples(selectedExamples);
  runtimeExamples.forEach((example, index) => {
    startExample(example, index, openBrowser);
  });
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  log(
    `${COLORS.red}Failed to start examples: ${message}${COLORS.reset}`,
    COLORS.red,
  );
  releaseRunLock();
  cleanupAndExit(1);
});
