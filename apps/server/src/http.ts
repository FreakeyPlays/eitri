import { EitriRpcs, RPC_PATH } from "@eitri/contracts/rpc";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { RpcHandlers } from "./rpc.ts";

// Packaged Tauri origins and the same-origin development proxy.
const clientOrigins = new Set([
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
  "http://localhost:1420",
  "http://127.0.0.1:1420",
]);

/** Same-origin localhost clients may use an ephemeral server port. */
const isLocalOrigin = (origin: string, host: string | undefined) => {
  if (origin !== `http://${host}`) return false;
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
};

/**
 * A WebSocket ignores the same-origin policy, so any page the user visits could
 * open one to localhost. Foreign origins are refused before the upgrade.
 */
const OriginGuard = HttpRouter.middleware(
  (httpEffect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const origin = request.headers["origin"];
      if (
        origin !== undefined &&
        !clientOrigins.has(origin) &&
        !isLocalOrigin(origin, request.headers["host"])
      ) {
        return HttpServerResponse.text("Origin not allowed.", { status: 403 });
      }
      return yield* httpEffect;
    }),
  { global: true },
);

/** The health check and the RPC WebSocket; the application supplies Bun and the project store. */
export const HttpRoutes = Layer.mergeAll(
  HttpRouter.add("GET", "/health", HttpServerResponse.jsonUnsafe({ status: "ok" })),
  RpcServer.layerHttp({ group: EitriRpcs, path: RPC_PATH, protocol: "websocket" }).pipe(
    Layer.provide(RpcHandlers),
    Layer.provide(RpcSerialization.layerJson),
  ),
  OriginGuard,
);
