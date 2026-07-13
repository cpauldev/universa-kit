import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source = resolve("src/adapters/client-entry/next-loader.cjs");
const destination = resolve("dist/adapters/client-entry/next-loader.cjs");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
