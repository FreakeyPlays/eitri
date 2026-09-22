import { AGENT_ENDPOINT, AgentAnswerSchema } from "@eitri/contracts/agent";
import {
  BrowseFoldersFailureSchema,
  BrowseFoldersRequestSchema,
  FOLDERS_ENDPOINT,
  FolderListingSchema,
} from "@eitri/contracts/folder";
import {
  ForgetProjectRequestSchema,
  OpenedProjectSchema,
  OpenProjectRequestSchema,
  PROJECTS_ENDPOINT,
  ProjectsFailureSchema,
  ProjectsSchema,
  RenameProjectRequestSchema,
} from "@eitri/contracts/project";
import { Effect, type Latch, Layer, Schema } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { AgentError, askAgent } from "./agent.ts";
import { FoldersError, listFolders } from "./folders.ts";
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

const PROJECT_METHODS = "GET, POST, PATCH, DELETE";
const FOLDER_METHODS = "GET";

const encodeFolders = Schema.encodeSync(FolderListingSchema);
const encodeFolderFailure = Schema.encodeSync(BrowseFoldersFailureSchema);
const encodeProjects = Schema.encodeSync(ProjectsSchema);
const encodeOpenedProject = Schema.encodeSync(OpenedProjectSchema);
const encodeFailure = Schema.encodeSync(ProjectsFailureSchema);
const decodeOpen = Schema.decodeUnknownEffect(OpenProjectRequestSchema);
const decodeForget = Schema.decodeUnknownEffect(ForgetProjectRequestSchema);
const decodeRename = Schema.decodeUnknownEffect(RenameProjectRequestSchema);
const decodeFolderRequest = Schema.decodeUnknownEffect(BrowseFoldersRequestSchema);

const foldersHandler = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const parameter = new URL(request.url, "http://localhost").searchParams.get("path");
  const { path } = yield* decodeFolderRequest(parameter === null ? {} : { path: parameter }).pipe(
    Effect.mapError(
      (error) => new FoldersError({ message: error.message.split("\n")[0], status: 400 }),
    ),
  );
  return yield* listFolders(path);
}).pipe(
  Effect.map((listing) => HttpServerResponse.jsonUnsafe(encodeFolders(listing))),
  Effect.catchTag("FoldersError", (error) =>
    Effect.succeed(
      HttpServerResponse.jsonUnsafe(encodeFolderFailure(error.message), { status: error.status }),
    ),
  ),
);

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

const openedProjectAnswer = <R>(
  project: Effect.Effect<typeof OpenedProjectSchema.Type, ProjectsError, R>,
) =>
  project.pipe(
    Effect.map((opened) => HttpServerResponse.jsonUnsafe(encodeOpenedProject(opened))),
    Effect.catchTag("ProjectsError", (error) =>
      Effect.succeed(
        HttpServerResponse.jsonUnsafe(encodeFailure(error.message), { status: error.status }),
      ),
    ),
  );

const projectJson = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  return yield* request.json.pipe(
    Effect.mapError(() => new ProjectsError({ message: "Expected a JSON body.", status: 400 })),
  );
});

const decoded = <A>(
  decode: (body: unknown) => Effect.Effect<A, { message: string }>,
  body: unknown,
) =>
  decode(body).pipe(
    Effect.mapError(
      (error) => new ProjectsError({ message: error.message.split("\n")[0], status: 400 }),
    ),
  );

/** Validates the requested path at the backend boundary before touching the disk. */
const projectBody = <A>(decode: (body: unknown) => Effect.Effect<A, { message: string }>) =>
  Effect.flatMap(projectJson, (body) => decoded(decode, body));

const selectProjectHandler = (store: ProjectStore) =>
  openedProjectAnswer(
    Effect.gen(function* () {
      const { path } = yield* projectBody(decodeOpen);
      return yield* store.open(path);
    }),
  );

const forgetProjectHandler = (store: ProjectStore) =>
  projectsAnswer(
    Effect.gen(function* () {
      const { id } = yield* projectBody(decodeForget);
      return yield* store.forget(id);
    }),
  );

const renameProjectHandler = (store: ProjectStore) =>
  projectsAnswer(
    Effect.gen(function* () {
      const { id, name } = yield* projectBody(decodeRename);
      return yield* store.rename(id, name);
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
    HttpRouter.add("*", FOLDERS_ENDPOINT, (request) => {
      switch (request.method) {
        case "GET":
          return foldersHandler;
        case "OPTIONS":
          return Effect.succeed(preflight(FOLDER_METHODS));
        default:
          return Effect.succeed(methodNotAllowed(FOLDER_METHODS));
      }
    }),
    HttpRouter.add("*", PROJECTS_ENDPOINT, (request) => {
      switch (request.method) {
        case "GET":
          return projectsAnswer(options.projects.snapshot);
        case "POST":
          return selectProjectHandler(options.projects);
        case "PATCH":
          return renameProjectHandler(options.projects);
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
