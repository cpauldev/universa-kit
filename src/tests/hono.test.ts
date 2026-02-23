import { describe, expect, it } from "bun:test";

import { attachBridgeSocketToHonoNodeServer } from "../adapters/server/hono.js";
import { createMiddlewareAdapterServerFixture } from "./utils/adapter-server-fixtures.js";

describe("hono adapter", () => {
  it("attaches through the node-server integration surface", async () => {
    const fixture = createMiddlewareAdapterServerFixture();
    const handle = await attachBridgeSocketToHonoNodeServer(fixture.server, {
      autoStart: false,
    });

    expect(fixture.getMiddlewareCount()).toBe(1);
    expect(fixture.getListenerCount("upgrade")).toBe(1);
    expect(fixture.getListenerCount("close")).toBe(1);

    await handle.close();
  });
});
