export const BRIDGE_PREFIX_DEFAULT = "/__bridgesocket";
export const EVENTS_PATH = "/events";
export const API_PROXY_PREFIX = "/api";
export const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};
export const DEFAULT_FALLBACK_COMMAND = "bridgesocket dev";
export const BRIDGESOCKET_PROTOCOL_VERSION = "1";
export const BRIDGESOCKET_WS_SUBPROTOCOL = `bridgesocket.v${BRIDGESOCKET_PROTOCOL_VERSION}+json`;
export const WS_HEARTBEAT_INTERVAL_MS_DEFAULT = 30_000;
