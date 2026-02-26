#!/usr/bin/env bun

import { type ChildProcess, exec, spawn } from "child_process";
import { existsSync, unlinkSync } from "fs";
import { createServer } from "net";
import { platform } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, "../..");
const MAX_PORT_SEARCH_ATTEMPTS = 100;
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
  defaultPort: number;
  env?: Record<string, string>;
}

interface RuntimeExample extends ExampleDefinition {
  port: number;
  cwd: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

const EXAMPLES: ExampleDefinition[] = [
  {
    id: "react",
    name: "React",
    dir: "react",
    defaultPort: 5173,
  },
  {
    id: "vue",
    name: "Vue",
    dir: "vue",
    defaultPort: 5174,
  },
  {
    id: "sveltekit",
    name: "SvelteKit",
    dir: "sveltekit",
    defaultPort: 5175,
  },
  {
    id: "astro",
    name: "Astro",
    dir: "astro",
    defaultPort: 4321,
  },
  {
    id: "nextjs",
    name: "Next.js",
    dir: "nextjs",
    defaultPort: 3000,
  },
  {
    id: "nuxt",
    name: "Nuxt",
    dir: "nuxt",
    defaultPort: 3001,
    // NUXT_SOCKET=0: workaround for Windows ECONNRESET (nuxt/cli#994)
    env: { NUXT_SOCKET: "0" },
  },
  {
    id: "vanilla",
    name: "Vanilla",
    dir: "vanilla",
    defaultPort: 5176,
  },
  {
    id: "vinext",
    name: "Vinext",
    dir: "vinext",
    defaultPort: 5177,
  },
];

const runningProcesses: ChildProcess[] = [];

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

async function findAvailablePort(
  basePort: number,
  reservedPorts: Set<number>,
): Promise<number> {
  for (
    let candidate = basePort;
    candidate < basePort + MAX_PORT_SEARCH_ATTEMPTS;
    candidate += 1
  ) {
    if (reservedPorts.has(candidate)) {
      continue;
    }

    if (await isPortAvailable(candidate)) {
      reservedPorts.add(candidate);
      return candidate;
    }
  }

  throw new Error(
    `Could not find an open port for ${basePort} within +${MAX_PORT_SEARCH_ATTEMPTS} ports`,
  );
}

function toRuntimeExample(
  definition: ExampleDefinition,
  resolvedPort: number,
): RuntimeExample {
  return {
    ...definition,
    port: resolvedPort,
    cwd: join(ROOT_DIR, "examples", definition.dir),
    command: "bun",
    args: ["run", "dev", "--port", String(resolvedPort)],
    env: { PORT: String(resolvedPort), ...(definition.env ?? {}) },
  };
}

async function resolveRuntimeExamples(
  definitions: ExampleDefinition[],
): Promise<RuntimeExample[]> {
  const reservedPorts = new Set<number>();
  const resolvedExamples: RuntimeExample[] = [];

  for (const definition of definitions) {
    const resolvedPort = await findAvailablePort(
      definition.defaultPort,
      reservedPorts,
    );
    resolvedExamples.push(toRuntimeExample(definition, resolvedPort));
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

function cleanupAndExit(code = 0) {
  log("\n\nShutting down all servers...", COLORS.yellow);
  runningProcesses.forEach((processHandle) => {
    processHandle.kill();
  });
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

  childProcess.stdout?.on("data", (data) => {
    const output = data.toString();
    pushOutputTail(outputTail, output);

    if (!hasShownReady && includesAny(output, READY_MARKERS)) {
      log(
        `${COLORS.green}✓${COLORS.reset} ${example.name.padEnd(12)} ${COLORS.bright}${url}${COLORS.reset}`,
      );
      hasShownReady = true;
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
  cleanupAndExit(1);
});
