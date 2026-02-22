import { afterEach, describe, it } from "bun:test";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { WebSocket } from "ws";

import {
  type StandaloneBridgeServer,
  startStandaloneDevSocketBridgeServer,
} from "../../bridge/standalone.js";

interface RuntimeStatusEvent {
  type: "runtime-status";
  timestamp: number;
  status: {
    phase: string;
  };
}

interface RuntimeErrorEvent {
  type: "runtime-error";
  timestamp: number;
  error: string;
}

type BridgeEvent = RuntimeStatusEvent | RuntimeErrorEvent;

const fixtureRuntimeScript = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../fixtures/runtime-e2e-server.cjs",
);

const standaloneServers = new Set<StandaloneBridgeServer>();
const sockets = new Set<WebSocket>();

afterEach(async () => {
  await Promise.all(
    [...sockets].map(
      (socket) =>
        new Promise<void>((resolve) => {
          if (socket.readyState === WebSocket.CLOSED) {
            resolve();
            return;
          }
          socket.once("close", () => resolve());
          socket.close();
        }),
    ),
  );
  sockets.clear();

  await Promise.all(
    [...standaloneServers].map(async (server) => {
      await server.close();
    }),
  );
  standaloneServers.clear();
});

function toWebSocketUrl(baseUrl: string): string {
  return baseUrl.replace(/^http/, "ws");
}

async function waitForRuntimePhase(
  socket: WebSocket,
  expectedPhase: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for phase: ${expectedPhase}`)),
      10000,
    );

    const onMessage = (payload: WebSocket.RawData) => {
      try {
        const event = JSON.parse(payload.toString()) as BridgeEvent;
        if (
          event.type === "runtime-status" &&
          event.status.phase === expectedPhase
        ) {
          clearTimeout(timeout);
          socket.off("message", onMessage);
          resolve();
        }
      } catch {
        // Ignore invalid event payloads.
      }
    };

    socket.on("message", onMessage);
  });
}

describe("bridge events e2e", () => {
  it("emits runtime-status events for start and stop", async () => {
    const server = await startStandaloneDevSocketBridgeServer({
      autoStart: false,
      command: process.execPath,
      args: [fixtureRuntimeScript],
      startTimeoutMs: 5000,
    });
    standaloneServers.add(server);

    const socket = new WebSocket(
      `${toWebSocketUrl(server.baseUrl)}/__devsocket/events`,
    );
    sockets.add(socket);

    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", (error) => reject(error));
    });

    const runningPhase = waitForRuntimePhase(socket, "running");
    await fetch(`${server.baseUrl}/__devsocket/runtime/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    await runningPhase;

    const stoppedPhase = waitForRuntimePhase(socket, "stopped");
    await fetch(`${server.baseUrl}/__devsocket/runtime/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    await stoppedPhase;
  });
});
