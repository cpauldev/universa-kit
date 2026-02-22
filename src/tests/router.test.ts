import { describe, expect, it } from "bun:test";

import { createRouteKey, matchBridgeRoute } from "../bridge/router.js";

function createRequest(
  method: string,
  url: string,
): import("http").IncomingMessage {
  return {
    method,
    url,
  } as import("http").IncomingMessage;
}

describe("bridge router", () => {
  it("matches bridge endpoints with and without query strings", () => {
    const prefix = "/__devsocket";
    const cases = [
      { method: "GET", url: "/__devsocket/health", key: "GET /health" },
      {
        method: "GET",
        url: "/__devsocket/health?source=ui",
        key: "GET /health",
      },
      { method: "GET", url: "/__devsocket/state", key: "GET /state" },
      { method: "GET", url: "/__devsocket/state?source=ui", key: "GET /state" },
      {
        method: "GET",
        url: "/__devsocket/runtime/status?check=1",
        key: "GET /runtime/status",
      },
      {
        method: "POST",
        url: "/__devsocket/runtime/start?manual=true",
        key: "POST /runtime/start",
      },
      {
        method: "POST",
        url: "/__devsocket/runtime/restart?manual=true",
        key: "POST /runtime/restart",
      },
      {
        method: "POST",
        url: "/__devsocket/runtime/stop?manual=true",
        key: "POST /runtime/stop",
      },
      {
        method: "GET",
        url: "/__devsocket/api/version?debug=true",
        key: "GET /api/version",
      },
    ];

    for (const testCase of cases) {
      const match = matchBridgeRoute(
        createRequest(testCase.method, testCase.url),
        prefix,
      );
      expect(match).not.toBeNull();
      if (!match) {
        continue;
      }
      expect(createRouteKey(match.method, match.routePath)).toBe(testCase.key);
    }
  });

  it("returns null for non-bridge paths", () => {
    const match = matchBridgeRoute(
      createRequest("GET", "/api/version"),
      "/__devsocket",
    );
    expect(match).toBeNull();
  });
});
