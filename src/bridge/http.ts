import type { IncomingMessage, ServerResponse } from "http";

import type { BridgeSocketErrorPayload } from "../types.js";
import { JSON_HEADERS } from "./constants.js";

export function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function writeJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  res.writeHead(statusCode, JSON_HEADERS);
  res.end(JSON.stringify(payload));
}

export function writeError(
  res: ServerResponse,
  statusCode: number,
  error: BridgeSocketErrorPayload,
): void {
  writeJson(res, statusCode, {
    success: false,
    message: error.message,
    error,
  });
}
