import * as BunServices from "@effect/platform-bun/BunServices";
import { RPC_PATH } from "@eitri/contracts/rpc";
import { Console, Effect, Exit, Fiber, Layer, Scope } from "effect";
import { type Rpc, RpcClient, type RpcGroup, RpcSerialization } from "effect/unstable/rpc";
import { Socket } from "effect/unstable/socket";
import { runServer } from "./server.ts";

/** Boots the real server on an ephemeral port; bin.test.ts covers the executable itself. */
export const start = (dataDir: string) => {
  const announced: string[] = [];
  const recorder: Console.Console = Object.assign(Object.create(console), {
    log: (...args: ReadonlyArray<unknown>) => announced.push(args.join(" ")),
  });
  const fiber = Effect.runFork(
    runServer({ port: 0, sidecar: false, dataDir }).pipe(
      Effect.provideService(Console.Console, recorder),
      Effect.provide(BunServices.layer),
    ),
  );
  const url = (async () => {
    const deadline = Date.now() + 5_000;
    while (announced.length === 0) {
      if (Date.now() > deadline) throw new Error("Server never announced its address.");
      await Bun.sleep(5);
    }
    const match = /listening on (http:\/\/[^\s]+)/.exec(announced[0]);
    if (!match) throw new Error(`Unexpected announcement: ${announced[0]}`);
    return match[1];
  })();
  return { url, announced, stop: () => Effect.runPromise(Fiber.interrupt(fiber)) };
};

/** The RPC WebSocket of the server announced at `url`. */
export const socketUrl = (url: string) => new URL(RPC_PATH, url.replace(/^http/, "ws")).href;

/**
 * An RPC client over a real WebSocket, connected the way the Angular client is.
 * A looser group lets a test send what a well-behaved client never would.
 */
export const connect = async <Rpcs extends Rpc.Any>(
  url: string,
  group: RpcGroup.RpcGroup<Rpcs>,
) => {
  const scope = Scope.makeUnsafe();
  const client = await Effect.runPromise(
    Effect.gen(function* () {
      const protocol = yield* Layer.build(
        RpcClient.layerProtocolSocket().pipe(
          Layer.provide(Socket.layerWebSocket(socketUrl(url))),
          Layer.provide(Socket.layerWebSocketConstructorGlobal),
          Layer.provide(RpcSerialization.layerJson),
        ),
      );
      return yield* RpcClient.make(group).pipe(Effect.provide(protocol));
    }).pipe(Scope.provide(scope)),
  );
  return { client, close: () => Effect.runPromise(Scope.close(scope, Exit.void)) };
};

export type Connection<Rpcs extends Rpc.Any> = Awaited<ReturnType<typeof connect<Rpcs>>>;

export const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

export const failure = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(Effect.flip(effect));
