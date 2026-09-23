import { AgentError } from "@eitri/contracts/agent";
import { EitriRpcs } from "@eitri/contracts/rpc";
import { Effect } from "effect";
import { askAgent } from "../agents/agent.ts";
import { listFolders } from "../filesystem/folders.ts";
import { ProjectStore } from "../projects/project-store.ts";

/**
 * What the server does for each call in `EitriRpcs`. Payloads arrive decoded:
 * the RPC server refuses one that breaks its schema before a handler runs.
 * Shutting down interrupts every handler, which stops a running CLI with it.
 */
export const RpcHandlers = EitriRpcs.toLayer(
  Effect.gen(function* () {
    const projects = yield* ProjectStore;
    return EitriRpcs.of({
      "projects.list": () => projects.snapshot,
      "projects.open": ({ path }) => projects.open(path),
      "projects.rename": ({ id, name }) => projects.rename(id, name),
      "projects.forget": ({ id }) => projects.forget(id),
      "folders.browse": ({ path }) => listFolders(path),
      // A CLI's error output can run long; the first line is the sentence worth showing.
      "agent.ask": (request) =>
        Effect.mapError(
          askAgent(request),
          (error) => new AgentError({ message: error.message.split("\n")[0] }),
        ),
    });
  }),
);
