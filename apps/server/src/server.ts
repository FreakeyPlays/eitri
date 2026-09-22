import { PROMPT_MAX_BYTES } from "@eitri/contracts/agent";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import { Console, Effect, Latch, Layer, Stdio, Stream } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpRoutes } from "./http.ts";
import { makeProjectStore } from "./projects.ts";

/** `dataDir` has no default here; only `bin.ts` decides which data a run may touch. */
export const runServer = (options: {
  readonly port: number;
  readonly sidecar: boolean;
  readonly dataDir: string;
}) =>
  Effect.gen(function* () {
    const shutdown = yield* Latch.make();
    const projects = makeProjectStore(options.dataDir);
    const Server = HttpRouter.serve(HttpRoutes({ shutdown, projects }), {
      disableLogger: false,
      disableListenLog: true,
    }).pipe(
      Layer.provideMerge(
        BunHttpServer.layer({
          hostname: "127.0.0.1",
          port: options.port,
          idleTimeout: 130,
          maxRequestBodySize: PROMPT_MAX_BYTES * 6 + 1024,
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

    yield* Effect.gen(function* () {
      yield* projects.ready;
      yield* announce.pipe(
        Effect.andThen(awaitShutdown),
        Effect.ensuring(shutdown.open),
        Effect.provide(Server),
      );
    }).pipe(Effect.ensuring(Effect.orDie(projects.close)));
  });
