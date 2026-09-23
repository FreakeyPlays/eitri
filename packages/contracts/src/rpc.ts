import * as Schema from "effect/Schema";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import { AgentAnswerSchema, AgentError, AgentRequestSchema } from "@eitri/contracts/agent";
import {
  BrowseFoldersRequestSchema,
  FolderListingSchema,
  FoldersError,
} from "@eitri/contracts/folder";
import {
  ForgetProjectRequestSchema,
  OpenedProjectSchema,
  OpenProjectRequestSchema,
  ProjectsError,
  ProjectsSchema,
  RenameProjectRequestSchema,
} from "@eitri/contracts/project";

/** Where the server accepts the RPC WebSocket. The Angular dev server proxies it. */
export const RPC_PATH = "/api/rpc";

/**
 * Every call a client can make to the server, over one WebSocket. The server's
 * handlers and the client's typed calls both derive from this group, so a
 * payload, answer or error changes in one place.
 */
export const EitriRpcs = RpcGroup.make(
  Rpc.make("projects.list", { success: ProjectsSchema, error: ProjectsError }),
  Rpc.make("projects.open", {
    payload: OpenProjectRequestSchema,
    success: OpenedProjectSchema,
    error: ProjectsError,
  }),
  Rpc.make("projects.rename", {
    payload: RenameProjectRequestSchema,
    success: ProjectsSchema,
    error: ProjectsError,
  }),
  Rpc.make("projects.forget", {
    payload: ForgetProjectRequestSchema,
    success: ProjectsSchema,
    error: ProjectsError,
  }),
  Rpc.make("folders.browse", {
    payload: BrowseFoldersRequestSchema,
    success: FolderListingSchema,
    error: FoldersError,
  }),
  Rpc.make("agent.ask", {
    payload: AgentRequestSchema,
    success: AgentAnswerSchema,
    error: AgentError,
  }),
);

/** The errors a server answers with on purpose; anything else is a transport or server fault. */
export const ServerErrorSchema = Schema.Union([ProjectsError, FoldersError, AgentError]);
