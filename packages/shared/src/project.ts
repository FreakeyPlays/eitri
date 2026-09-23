import {
  type ForgetProjectRequest,
  ForgetProjectRequestSchema,
  type OpenProjectRequest,
  OpenProjectRequestSchema,
  type RenameProjectRequest,
  RenameProjectRequestSchema,
} from "@eitri/contracts/project";
import * as Schema from "effect/Schema";

const decodeOpen = Schema.decodeUnknownSync(OpenProjectRequestSchema);
const decodeForget = Schema.decodeUnknownSync(ForgetProjectRequestSchema);
const decodeRename = Schema.decodeUnknownSync(RenameProjectRequestSchema);

const sentence = (error: unknown) =>
  new Error(String(error instanceof Error ? error.message : error).split("\n")[0]);

export function toOpenProjectRequest(path: string): OpenProjectRequest {
  try {
    return decodeOpen({ path });
  } catch (error: unknown) {
    throw sentence(error);
  }
}

export function toForgetProjectRequest(id: string): ForgetProjectRequest {
  try {
    return decodeForget({ id });
  } catch (error: unknown) {
    throw sentence(error);
  }
}

/** Trims here so the schema can reject only names that are genuinely unusable. */
export function toRenameProjectRequest(id: string, name: string): RenameProjectRequest {
  try {
    return decodeRename({ id, name: name.trim() });
  } catch (error: unknown) {
    throw sentence(error);
  }
}
