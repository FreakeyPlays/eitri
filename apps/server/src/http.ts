import { AGENT_ENDPOINT, AgentAnswerSchema } from "@eitri/contracts/agent";
import {
  ForgetProjectRequestSchema,
  PROJECTS_ENDPOINT,
  ProjectsFailureSchema,
  ProjectsSchema,
  SelectProjectRequestSchema,
} from "@eitri/contracts/project";
import { Effect, type Latch, Layer, Schema } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { AgentError, askAgent } from "./agent.ts";
import { ProjectsError, type ProjectStore } from "./projects.ts";

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

const preflight = (methods: string) =>
  HttpServerResponse.empty({
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": methods,
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });

const methodNotAllowed = (methods: string) =>
  HttpServerResponse.setHeader(answer("Method not allowed.", 405), "Allow", methods);

const PROJECT_METHODS = "GET, POST, DELETE";

const encodeProjects = Schema.encodeSync(ProjectsSchema);
const encodeFailure = Schema.encodeSync(ProjectsFailureSchema);
const decodeSelect = Schema.decodeUnknownEffect(SelectProjectRequestSchema);
const decodeForget = Schema.decodeUnknownEffect(ForgetProjectRequestSchema);

/** Projects answer with a snapshot, or with a message the picker can show. */
const projectsAnswer = <R>(projects: Effect.Effect<typeof ProjectsSchema.Type, ProjectsError, R>) =>
  projects.pipe(
    Effect.map((snapshot) => HttpServerResponse.jsonUnsafe(encodeProjects(snapshot))),
    Effect.catchTag("ProjectsError", (error) =>
      Effect.succeed(
        HttpServerResponse.jsonUnsafe(encodeFailure(error.message), { status: error.status }),
      ),
    ),
  );

/** Validates the requested path at the backend boundary before touching the disk. */
const projectBody = <A>(decode: (body: unknown) => Effect.Effect<A, { message: string }>) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const body = yield* request.json.pipe(
      Effect.mapError(() => new ProjectsError({ message: "Expected a JSON body.", status: 400 })),
    );
    return yield* decode(body).pipe(
      Effect.mapError(
        (error) => new ProjectsError({ message: error.message.split("\n")[0], status: 400 }),
      ),
    );
  });

const selectProjectHandler = (store: ProjectStore) =>
  projectsAnswer(
    Effect.gen(function* () {
      const { path } = yield* projectBody(decodeSelect);
      return yield* store.select(path);
    }),
  );

const forgetProjectHandler = (store: ProjectStore) =>
  projectsAnswer(
    Effect.gen(function* () {
      const { path } = yield* projectBody(decodeForget);
      return yield* store.forget(path);
    }),
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
export const HttpRoutes = (options: {
  readonly shutdown: Latch.Latch;
  readonly projects: ProjectStore;
}) =>
  Layer.mergeAll(
    HttpRouter.add("GET", "/health", HttpServerResponse.jsonUnsafe({ status: "ok" })),
    HttpRouter.add("*", AGENT_ENDPOINT, (request) => {
      switch (request.method) {
        case "POST":
          return agentHandler(options.shutdown);
        case "OPTIONS":
          return Effect.succeed(preflight("POST"));
        default:
          return Effect.succeed(methodNotAllowed("POST"));
      }
    }),
    HttpRouter.add("*", PROJECTS_ENDPOINT, (request) => {
      switch (request.method) {
        case "GET":
          return projectsAnswer(options.projects.snapshot);
        case "POST":
          return selectProjectHandler(options.projects);
        case "DELETE":
          return forgetProjectHandler(options.projects);
        case "OPTIONS":
          return Effect.succeed(preflight(PROJECT_METHODS));
        default:
          return Effect.succeed(methodNotAllowed(PROJECT_METHODS));
      }
    }),
    Cors,
  );
