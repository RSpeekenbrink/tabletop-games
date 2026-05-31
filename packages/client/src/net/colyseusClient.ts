import { Client } from "colyseus.js";

function resolveEndpoint(): string {
  if (import.meta.env.VITE_COLYSEUS_URL) {
    return import.meta.env.VITE_COLYSEUS_URL as string;
  }
  // In production the server hosts both the WS and static client on the same
  // origin; in dev Vite proxies /matchmake to the Colyseus server.
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}`;
}

export const colyseusClient = new Client(resolveEndpoint());
