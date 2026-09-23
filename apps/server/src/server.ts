import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import { Console, Effect, Layer, Stdio, Stream } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { Database } from "./storage/database.ts";
import { HttpRoutes } from "./transport/http.ts";
import { ProjectStore } from "./projects/project-store.ts";

/** `dataDir` has no default here; only `bin.ts` decides which data a run may touch. */
export const runServer = (options: {
  readonly port: number;
  readonly sidecar: boolean;
  readonly dataDir: string;
}) =>
  Effect.gen(function* () {
    const Server = HttpRouter.serve(HttpRoutes, {
      disableLogger: false,
      disableListenLog: true,
    }).pipe(
      Layer.provide(ProjectStore.layer),
      Layer.provide(Database(options.dataDir)),
      Layer.provideMerge(
        BunHttpServer.layer({
          hostname: "127.0.0.1",
          port: options.port,
          // Close open WebSockets right away: waiting for clients to leave would hold shutdown open.
          disablePreemptiveShutdown: true,
        }),
      ),
    );

    const announce = HttpServer.addressFormattedWith((url) =>
      Console.log(options.sidecar ? JSON.stringify({ url }) : `Server listening on ${url}`),
    );
    const awaitShutdown = options.sidecar
      ? Effect.gen(function* () {
          const stdio = yield* Stdio.Stdio;
          yield* Stream.runHead(stdio.stdin);
        })
      : Effect.never;

    // The database is migrated while the layer builds, so a broken one fails before the announcement.
    yield* announce.pipe(Effect.andThen(awaitShutdown), Effect.provide(Server));
  });
