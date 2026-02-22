import type { IncomingMessage, ServerResponse } from "http";
import { URL } from "url";

import { readRequestBody } from "./http.js";

export interface RuntimeProxyContext {
  shouldAutoStartRuntime: () => boolean;
  ensureRuntimeStarted: () => Promise<unknown>;
  getRuntimeUrl: () => string | null;
  fallbackCommand: string;
  onRuntimeError: (error: string) => void;
  writeBridgeError: (
    res: ServerResponse,
    statusCode: number,
    code:
      | "runtime_start_failed"
      | "runtime_unavailable"
      | "bridge_proxy_failed",
    message: string,
    options?: {
      retryable?: boolean;
      details?: Record<string, unknown>;
    },
  ) => void;
}

function extractSetCookieHeaders(headers: Headers): string[] {
  const headersWithGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof headersWithGetSetCookie.getSetCookie === "function") {
    return headersWithGetSetCookie.getSetCookie();
  }

  const setCookieHeader = headers.get("set-cookie");
  return setCookieHeader ? [setCookieHeader] : [];
}

export async function proxyToRuntime(
  req: IncomingMessage,
  res: ServerResponse,
  runtimePathWithSearch: string,
  context: RuntimeProxyContext,
): Promise<void> {
  if (context.shouldAutoStartRuntime()) {
    try {
      await context.ensureRuntimeStarted();
    } catch (error) {
      context.writeBridgeError(
        res,
        503,
        "runtime_start_failed",
        error instanceof Error ? error.message : "Unable to start runtime",
        {
          retryable: true,
          details: {
            fallbackCommand: context.fallbackCommand,
            reason: "runtime_start_failed",
          },
        },
      );
      return;
    }
  }

  const runtimeUrl = context.getRuntimeUrl();
  if (!runtimeUrl) {
    context.writeBridgeError(
      res,
      503,
      "runtime_unavailable",
      "Runtime is not running",
      {
        retryable: true,
        details: {
          fallbackCommand: context.fallbackCommand,
        },
      },
    );
    return;
  }

  const target = new URL(`/api${runtimePathWithSearch || ""}`, runtimeUrl);
  const body =
    req.method && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)
      ? await readRequestBody(req)
      : undefined;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method || "GET",
      headers,
      body: body && body.length > 0 ? new Uint8Array(body) : undefined,
    });
  } catch (error) {
    context.writeBridgeError(
      res,
      502,
      "bridge_proxy_failed",
      error instanceof Error ? error.message : "Bridge proxy failed",
      {
        retryable: true,
        details: {
          target: target.toString(),
        },
      },
    );
    return;
  }

  if (upstream.status >= 500) {
    context.onRuntimeError(
      `Upstream runtime returned ${upstream.status} for ${target.pathname}`,
    );
  }

  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      res.setHeader(key, value);
    }
  });
  const setCookieValues = extractSetCookieHeaders(upstream.headers);
  if (setCookieValues.length > 0) {
    res.setHeader("set-cookie", setCookieValues);
  }

  res.statusCode = upstream.status;
  res.end(Buffer.from(await upstream.arrayBuffer()));
}
