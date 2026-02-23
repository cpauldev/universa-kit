import { createServer } from "http";
import { createServer as createNetServer } from "net";

import {
  BridgeSocketBridge,
  type BridgeSocketBridgeOptions,
} from "./bridge.js";
import { writeJson } from "./http.js";

export interface StandaloneBridgeServer {
  baseUrl: string;
  close: () => Promise<void>;
  bridge: BridgeSocketBridge;
}

async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to resolve an available port"));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

export async function startStandaloneBridgeSocketBridgeServer(
  options: BridgeSocketBridgeOptions = {},
): Promise<StandaloneBridgeServer> {
  const bridge = new BridgeSocketBridge(options);
  const port = await findAvailablePort();
  const sockets = new Set<import("net").Socket>();
  const server = createServer((req, res) => {
    void bridge.handleHttpRequest(req, res, () => {
      writeJson(res, 404, { success: false, error: "Not found" });
    });
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => {
      sockets.delete(socket);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve());
  });

  server.on("upgrade", (req, socket, head) => {
    bridge.handleUpgrade(req, socket, head);
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    bridge,
    close: async () => {
      await bridge.close();
      for (const socket of sockets) {
        socket.destroy();
      }
      if (typeof server.closeAllConnections === "function") {
        server.closeAllConnections();
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            if (
              error instanceof Error &&
              "code" in error &&
              error.code === "ERR_SERVER_NOT_RUNNING"
            ) {
              resolve();
              return;
            }
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
