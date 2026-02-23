import {
  BRIDGESOCKET_WS_SUBPROTOCOL,
  BRIDGE_PREFIX_DEFAULT,
} from "../bridge/constants.js";
import type {
  BridgeSocketBridgeEvent,
  BridgeSocketBridgeState,
  BridgeSocketErrorResponse,
  BridgeSocketRuntimeStatus,
} from "../types.js";

export interface BridgeSocketClientOptions {
  baseUrl?: string;
  bridgePathPrefix?: string;
  fetchImpl?: typeof fetch;
  webSocketFactory?: (
    url: string,
    protocols: string[],
  ) => BridgeSocketWebSocketLike;
}

export interface BridgeSocketBridgeHealth extends BridgeSocketBridgeState {
  ok: true;
  bridge: true;
}

export interface BridgeSocketEventsSubscriptionOptions {
  onError?: (error: unknown) => void;
}

export interface BridgeSocketWebSocketLike {
  close: () => void;
  addEventListener?: (
    event: string,
    listener: (...args: unknown[]) => void,
  ) => void;
  removeEventListener?: (
    event: string,
    listener: (...args: unknown[]) => void,
  ) => void;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  off?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void,
  ) => void;
}

export class BridgeSocketClientError extends Error {
  statusCode: number;
  response: BridgeSocketErrorResponse | null;

  constructor(statusCode: number, response: BridgeSocketErrorResponse | null) {
    super(
      response?.error.message ?? `Request failed with status ${statusCode}`,
    );
    this.name = "BridgeSocketClientError";
    this.statusCode = statusCode;
    this.response = response;
  }
}

export interface BridgeSocketClient {
  getHealth: () => Promise<BridgeSocketBridgeHealth>;
  getState: () => Promise<BridgeSocketBridgeState>;
  getRuntimeStatus: () => Promise<BridgeSocketRuntimeStatus>;
  startRuntime: () => Promise<BridgeSocketRuntimeStatus>;
  restartRuntime: () => Promise<BridgeSocketRuntimeStatus>;
  stopRuntime: () => Promise<BridgeSocketRuntimeStatus>;
  subscribeEvents: (
    listener: (event: BridgeSocketBridgeEvent) => void,
    options?: BridgeSocketEventsSubscriptionOptions,
  ) => () => void;
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function joinPath(basePath: string, suffix: string): string {
  return `${basePath.replace(/\/$/, "")}${normalizePath(suffix)}`;
}

function resolveHttpUrl(baseUrl: string | undefined, path: string): string {
  if (!baseUrl) {
    return path;
  }

  return new URL(path, baseUrl).toString();
}

function resolveWebSocketUrl(
  baseUrl: string | undefined,
  path: string,
): string {
  if (baseUrl) {
    const url = new URL(path, baseUrl);
    if (url.protocol === "http:") {
      url.protocol = "ws:";
    } else if (url.protocol === "https:") {
      url.protocol = "wss:";
    }
    return url.toString();
  }

  if (typeof window !== "undefined") {
    const url = new URL(path, window.location.origin);
    url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  }

  throw new Error(
    "BridgeSocket client requires `baseUrl` in non-browser environments for WebSocket subscriptions.",
  );
}

function addSocketListener(
  socket: BridgeSocketWebSocketLike,
  event: string,
  listener: (...args: unknown[]) => void,
): void {
  if (typeof socket.addEventListener === "function") {
    socket.addEventListener(event, listener);
    return;
  }
  if (typeof socket.on === "function") {
    socket.on(event, listener);
    return;
  }
  throw new Error("WebSocket implementation does not support event listeners.");
}

function removeSocketListener(
  socket: BridgeSocketWebSocketLike,
  event: string,
  listener: (...args: unknown[]) => void,
): void {
  if (typeof socket.removeEventListener === "function") {
    socket.removeEventListener(event, listener);
    return;
  }
  if (typeof socket.off === "function") {
    socket.off(event, listener);
    return;
  }
  if (typeof socket.removeListener === "function") {
    socket.removeListener(event, listener);
  }
}

function extractMessagePayload(message: unknown): string {
  const textDecoder = new TextDecoder();

  if (typeof message === "string") {
    return message;
  }

  if (
    typeof message === "object" &&
    message !== null &&
    "data" in message &&
    typeof (message as { data?: unknown }).data !== "undefined"
  ) {
    return extractMessagePayload((message as { data: unknown }).data);
  }

  if (message instanceof ArrayBuffer) {
    return textDecoder.decode(new Uint8Array(message));
  }
  if (ArrayBuffer.isView(message)) {
    return textDecoder.decode(
      new Uint8Array(message.buffer, message.byteOffset, message.byteLength),
    );
  }

  return String(message);
}

export function createBridgeSocketClient(
  options: BridgeSocketClientOptions = {},
): BridgeSocketClient {
  const bridgePathPrefix = options.bridgePathPrefix ?? BRIDGE_PREFIX_DEFAULT;
  const fetchImpl = options.fetchImpl ?? fetch;

  const requestJson = async <T>(
    routeSuffix: string,
    init?: RequestInit,
  ): Promise<T> => {
    const routePath = joinPath(bridgePathPrefix, routeSuffix);
    const url = resolveHttpUrl(options.baseUrl, routePath);
    const response = await fetchImpl(url, init);

    if (!response.ok) {
      let payload: BridgeSocketErrorResponse | null;
      try {
        payload = (await response.json()) as BridgeSocketErrorResponse;
      } catch {
        payload = null;
      }
      throw new BridgeSocketClientError(response.status, payload);
    }

    return (await response.json()) as T;
  };

  const requestRuntimeControl = async (
    routeSuffix: "/runtime/start" | "/runtime/restart" | "/runtime/stop",
  ): Promise<BridgeSocketRuntimeStatus> => {
    const payload = await requestJson<{
      success: boolean;
      runtime: BridgeSocketRuntimeStatus;
    }>(routeSuffix, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{}",
    });

    return payload.runtime;
  };

  return {
    getHealth: () => requestJson<BridgeSocketBridgeHealth>("/health"),
    getState: () => requestJson<BridgeSocketBridgeState>("/state"),
    getRuntimeStatus: () =>
      requestJson<BridgeSocketRuntimeStatus>("/runtime/status"),
    startRuntime: () => requestRuntimeControl("/runtime/start"),
    restartRuntime: () => requestRuntimeControl("/runtime/restart"),
    stopRuntime: () => requestRuntimeControl("/runtime/stop"),
    subscribeEvents: (
      listener: (event: BridgeSocketBridgeEvent) => void,
      subscriptionOptions?: BridgeSocketEventsSubscriptionOptions,
    ) => {
      const eventsPath = joinPath(bridgePathPrefix, "/events");
      const webSocketUrl = resolveWebSocketUrl(options.baseUrl, eventsPath);
      const socket =
        options.webSocketFactory?.(webSocketUrl, [
          BRIDGESOCKET_WS_SUBPROTOCOL,
        ]) ??
        (new WebSocket(webSocketUrl, [
          BRIDGESOCKET_WS_SUBPROTOCOL,
        ]) as BridgeSocketWebSocketLike);

      const onMessage = (message: unknown) => {
        try {
          const payload = JSON.parse(
            extractMessagePayload(message),
          ) as BridgeSocketBridgeEvent;
          listener(payload);
        } catch (error) {
          subscriptionOptions?.onError?.(error);
        }
      };

      const onError = (...args: unknown[]) => {
        subscriptionOptions?.onError?.(args.length > 1 ? args : args[0]);
      };

      addSocketListener(socket, "message", onMessage);
      addSocketListener(socket, "error", onError);

      return () => {
        removeSocketListener(socket, "message", onMessage);
        removeSocketListener(socket, "error", onError);
        socket.close();
      };
    },
  };
}
