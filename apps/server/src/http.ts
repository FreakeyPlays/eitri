import { AGENT_ENDPOINT, AgentAnswerSchema } from "@eitri/contracts/agent";
import { Effect, type Latch, Layer, Schema } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { AgentError, askAgent } from "./agent.ts";

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

const encodeAnswer = Schema.encodeSync(AgentAnswerSchema);

/** Answers always carry the shared contract: a JSON string, successful or not. */
const answer = (body: string, status = 200) =>
  HttpServerResponse.jsonUnsafe(encodeAnswer(body), { status });

const cancelled = new AgentError({ message: "Agent request cancelled." });

/** Runs one CLI request, or answers `cancelled` as soon as shutdown starts. */
const agentHandler = (shutdown: Latch.Latch) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    return yield* askAgent(yield* request.json);
  }).pipe(
    Effect.raceFirst(Effect.andThen(shutdown.await, Effect.fail(cancelled))),
    Effect.map((output) => answer(output)),
    Effect.catch((error) => Effect.succeed(answer(error.message.split("\n")[0], 400))),
  );

const preflight = HttpServerResponse.empty({
  status: 204,
  headers: {
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "Content-Type",
  },
});

const methodNotAllowed = HttpServerResponse.setHeader(
  answer("Method not allowed.", 405),
  "Allow",
  "POST",
);

/** Foreign origins never reach a handler; allowed ones get their echo before the answer. */
const Cors = HttpRouter.middleware(
  (httpEffect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const origin = request.headers["origin"];
      if (
        origin !== undefined &&
        !clientOrigins.has(origin) &&
        !isLocalOrigin(origin, request.headers["host"])
      ) {
        return answer("Origin not allowed.", 403);
      }
      const response = yield* httpEffect;
      return HttpServerResponse.setHeaders(response, {
        Vary: "Origin",
        ...(origin === undefined ? {} : { "Access-Control-Allow-Origin": origin }),
      });
    }),
  { global: true },
);

/** Registers HTTP behavior; the application supplies the shutdown signal and Bun services. */
export const HttpRoutes = (shutdown: Latch.Latch) =>
  Layer.mergeAll(
    HttpRouter.add("GET", "/health", HttpServerResponse.jsonUnsafe({ status: "ok" })),
    HttpRouter.add("*", AGENT_ENDPOINT, (request) => {
      switch (request.method) {
        case "POST":
          return agentHandler(shutdown);
        case "OPTIONS":
          return Effect.succeed(preflight);
        default:
          return Effect.succeed(methodNotAllowed);
      }
    }),
    Cors,
  );
