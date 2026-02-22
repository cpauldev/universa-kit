#!/usr/bin/env node
import { execSync } from "node:child_process";

const IMPACTED_SOURCE_PATTERNS = [
  /^src\/bridge\//,
  /^src\/runtime\//,
  /^src\/adapters\//,
  /^src\/types\.ts$/,
  /^src\/index\.ts$/,
];

const REQUIRED_DOC_FILES = ["README.md", "PROTOCOL.md"];

function runCommand(command) {
  try {
    return execSync(command, {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

function parseLines(value) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function resolveChangedFiles() {
  const explicitFiles = process.env.DOCS_CHECK_FILES;
  if (explicitFiles) {
    return explicitFiles
      .split(/[,\r\n]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  const stagedFiles = parseLines(
    runCommand("git diff --name-only --diff-filter=ACMR --cached"),
  );
  if (stagedFiles.length > 0) {
    return stagedFiles;
  }

  if (process.env.GITHUB_BASE_REF) {
    const baseRef = `origin/${process.env.GITHUB_BASE_REF}`;
    const mergeBase = runCommand(`git merge-base HEAD ${baseRef}`);
    if (mergeBase) {
      const ciFiles = parseLines(
        runCommand(
          `git diff --name-only --diff-filter=ACMR ${mergeBase}...HEAD`,
        ),
      );
      if (ciFiles.length > 0) {
        return ciFiles;
      }
    }
  }

  return parseLines(
    runCommand("git diff --name-only --diff-filter=ACMR HEAD~1...HEAD"),
  );
}

function shouldRequireDocs(changedFiles) {
  return changedFiles.some((file) =>
    IMPACTED_SOURCE_PATTERNS.some((pattern) => pattern.test(file)),
  );
}

function main() {
  const changedFiles = resolveChangedFiles();
  if (changedFiles.length === 0) {
    console.log("docs:check skipped (no changed files detected).");
    return;
  }

  if (!shouldRequireDocs(changedFiles)) {
    console.log(
      "docs:check passed (no protocol/API-impacting source changes).",
    );
    return;
  }

  const changedFileSet = new Set(changedFiles);
  const missingDocs = REQUIRED_DOC_FILES.filter(
    (file) => !changedFileSet.has(file),
  );

  if (missingDocs.length > 0) {
    console.error("docs:check failed.");
    console.error(
      "Protocol/API-impacting changes were detected without required docs updates.",
    );
    console.error(`Missing required docs updates: ${missingDocs.join(", ")}`);
    console.error("Changed files:");
    changedFiles.forEach((file) => {
      console.error(`- ${file}`);
    });
    process.exit(1);
  }

  console.log("docs:check passed (required docs were updated).");
}

main();
