import {
  type ForgetProjectRequest,
  ForgetProjectRequestSchema,
  type Projects,
  ProjectsFailureSchema,
  ProjectsSchema,
  type SelectProjectRequest,
  SelectProjectRequestSchema,
} from "@eitri/contracts/project";
import * as Schema from "effect/Schema";

const decodeSelect = Schema.decodeUnknownSync(SelectProjectRequestSchema);
const decodeForget = Schema.decodeUnknownSync(ForgetProjectRequestSchema);
const decodeProjects = Schema.decodeUnknownSync(ProjectsSchema);
const decodeFailure = Schema.decodeUnknownSync(ProjectsFailureSchema);

// A schema error appends the failing path; only its first line reads as a sentence.
const sentence = (error: unknown) =>
  new Error(String(error instanceof Error ? error.message : error).split("\n")[0]);

/**
 * Turns a selection into a request the backend accepts, so a client rejects an
 * unusable path with the same rule and wording the backend does. `null` selects
 * every project at once. Throws the message meant for the user.
 */
export function toSelectProjectRequest(path: string | null): SelectProjectRequest {
  try {
    return decodeSelect({ path });
  } catch (error: unknown) {
    throw sentence(error);
  }
}

/** Turns a path into a request that drops it from the remembered list. */
export function toForgetProjectRequest(path: string): ForgetProjectRequest {
  try {
    return decodeForget({ path });
  } catch (error: unknown) {
    throw sentence(error);
  }
}

/** Reads a snapshot from any transport, so an unexpected payload never reaches the UI. */
export function readProjects(reply: unknown): Projects {
  try {
    return decodeProjects(reply);
  } catch {
    throw new Error("Unexpected response from the project backend.");
  }
}

/** Reads a refusal the backend sent on purpose; anything else gets a usable stand-in. */
export function readProjectsFailure(reply: unknown): string {
  try {
    return decodeFailure(reply);
  } catch {
    return "The project backend refused the request.";
  }
}
