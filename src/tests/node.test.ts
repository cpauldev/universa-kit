import { describe, expect, it } from "bun:test";

import {
  attachBridgeSocketToNodeServer,
  createNodeBridgeLifecycle,
} from "../adapters/server/node.js";
import { createMiddlewareAdapterServerFixture } from "./utils/adapter-server-fixtures.js";

describe("node adapter", () => {
  it("attaches and tears down bridge lifecycle", async () => {
    const fixture = createMiddlewareAdapterServerFixture();
    const handle = await attachBridgeSocketToNodeServer(fixture.server, {
      autoStart: false,
    });

    expect(fixture.getMiddlewareCount()).toBe(1);
    expect(fixture.getListenerCount("upgrade")).toBe(1);
    expect(fixture.getListenerCount("close")).toBe(1);
    expect(handle.bridge).toBeDefined();

    await handle.close();
  });

  it("exposes a reusable lifecycle", async () => {
    const fixture = createMiddlewareAdapterServerFixture();
    const lifecycle = createNodeBridgeLifecycle({ autoStart: false });

    await lifecycle.setup(fixture.server);
    expect(lifecycle.getBridge()).not.toBeNull();

    await lifecycle.teardown();
    expect(lifecycle.getBridge()).toBeNull();
  });
});
