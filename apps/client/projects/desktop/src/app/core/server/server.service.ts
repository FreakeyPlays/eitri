import { DestroyRef, inject, Service } from "@angular/core";
import { EitriRpcs, RPC_PATH, ServerErrorSchema } from "@eitri/contracts/rpc";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import type * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import * as RpcClientError from "effect/unstable/rpc/RpcClientError";
import type * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";
import * as Socket from "effect/unstable/socket/Socket";
import { ClientService } from "@core/client/client.service";

type Rpcs = RpcGroup.Rpcs<typeof EitriRpcs>;
type Call<Tag extends string> = Rpc.ExtractTag<Rpcs, Tag>;
type Payload<Tag extends string> = Rpc.PayloadConstructor<Call<Tag>>;

const UNREACHABLE =
  "Could not reach the Eitri server. Restart Eitri or check the server connection.";
const UNEXPECTED = "Unexpected response from the Eitri server.";

const isServerError = Schema.is(ServerErrorSchema);

/**
 * Where this client's RPC socket lives: beside the page in a browser, which the
 * dev server proxies, and at the origin the desktop shell reports in Tauri.
 */
export const socketUrl = (serverUrl: string, page = globalThis.location.href) => {
  const url = new URL(RPC_PATH, serverUrl || page);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
};

/** A failed call as one sentence: the server's own for a refusal, a plain one for anything else. */
export const sentenceOf = (cause: Cause.Cause<unknown>) => {
  const error = Cause.squash(cause);
  if (isServerError(error)) return error.message;
  return error instanceof RpcClientError.RpcClientError ? UNREACHABLE : UNEXPECTED;
};

/**
 * The one connection to the Eitri server, an Effect RPC client over a WebSocket.
 * Domain services call through here and never see the transport. The socket
 * opens with the first call; while the server is gone calls fail at once, and
 * the socket reconnects on its own once the server is back.
 */
@Service()
export class ServerService {
  private readonly client = inject(ClientService);
  private readonly scope = Scope.makeUnsafe();
  private connection: Promise<RpcClient.RpcClient<Rpcs, RpcClientError.RpcClientError>> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => void Effect.runPromise(Scope.close(this.scope, Exit.void)));
  }

  /** Resolves with the server's answer, or rejects with a sentence the user can act on. */
  async call<const Tag extends Rpc.Tag<Rpcs>>(
    tag: Tag,
    ...[payload]: Payload<Tag> extends void ? [] : [Payload<Tag>]
  ): Promise<Rpc.Success<Call<Tag>>> {
    const rpc = await this.connect();
    // Indexing the client by a generic tag loses its per-call signature; `tag` and `payload` still match.
    const send = rpc[tag] as unknown as (payload: unknown) => Effect.Effect<Rpc.Success<Call<Tag>>>;
    const exit = await Effect.runPromiseExit(send(payload));
    if (Exit.isSuccess(exit)) return exit.value;
    throw new Error(sentenceOf(exit.cause));
  }

  private connect() {
    return (this.connection ??= this.client
      .getServerUrl()
      .then((serverUrl) =>
        Effect.runPromise(
          Effect.gen(function* () {
            const protocol = yield* Layer.build(
              RpcClient.layerProtocolSocket().pipe(
                Layer.provide(Socket.layerWebSocket(socketUrl(serverUrl))),
                Layer.provide(Socket.layerWebSocketConstructorGlobal),
                Layer.provide(RpcSerialization.layerJson),
              ),
            );
            return yield* RpcClient.make(EitriRpcs).pipe(Effect.provide(protocol));
          }).pipe(Scope.provide(this.scope)),
        ),
      )
      .catch((error: unknown) => {
        // The desktop shell may not know the address yet; the next call asks again.
        this.connection = undefined;
        throw new Error(UNREACHABLE, { cause: error });
      }));
  }
}
