import { PROMPT_MAX_BYTES } from "@eitri/contracts/agent";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import { Console, Effect, Latch, Layer, Stdio, Stream } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpRoutes } from "./http.ts";

export const runServer = (options: { readonly port: number; readonly sidecar: boolean }) =>
  Effect.gen(function* () {
    const shutdown = yield* Latch.make();
    const Server = HttpRouter.serve(HttpRoutes(shutdown), {
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

    yield* announce.pipe(
      Effect.andThen(awaitShutdown),
      Effect.ensuring(shutdown.open),
      Effect.provide(Server),
    );
  });
