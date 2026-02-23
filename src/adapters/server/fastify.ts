import type { IncomingMessage, ServerResponse } from "http";

import {
  type BridgeSocketBridge,
  createBridgeSocketBridge,
} from "../../bridge/bridge.js";
import {
  type BridgeSocketAdapterOptions,
  resolveAdapterOptions,
} from "../shared/adapter-utils.js";

type FastifyDone = (error?: Error) => void;

export interface FastifyLikeRequest {
  raw: IncomingMessage;
}

export interface FastifyLikeReply {
  raw: ServerResponse;
}

export interface FastifyLikeInstance {
  addHook(
    name: "onRequest",
    hook: (
      request: FastifyLikeRequest,
      reply: FastifyLikeReply,
      done: FastifyDone,
    ) => void,
  ): void;
  addHook(
    name: "onClose",
    hook: (instance: unknown, done: FastifyDone) => void,
  ): void;
}

export interface FastifyBridgeHandle {
  bridge: BridgeSocketBridge;
  close: () => Promise<void>;
}

export type FastifyBridgeSocketOptions = BridgeSocketAdapterOptions;

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(String(value));
}

export async function attachBridgeSocketToFastify(
  fastify: FastifyLikeInstance,
  options: FastifyBridgeSocketOptions = {},
): Promise<FastifyBridgeHandle> {
  const bridge = await createBridgeSocketBridge(resolveAdapterOptions(options));

  fastify.addHook(
    "onRequest",
    (
      request: FastifyLikeRequest,
      reply: FastifyLikeReply,
      done: FastifyDone,
    ) => {
      void bridge
        .handleHttpRequest(request.raw, reply.raw, (error) =>
          done(error ? toError(error) : undefined),
        )
        .catch((error) => {
          if (!reply.raw.writableEnded) {
            done(toError(error));
          }
        });
    },
  );

  fastify.addHook("onClose", (_instance: unknown, done: FastifyDone) => {
    void bridge
      .close()
      .then(() => done())
      .catch((error) => done(toError(error)));
  });

  return {
    bridge,
    close: async () => {
      await bridge.close();
    },
  };
}
