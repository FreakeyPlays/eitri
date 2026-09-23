import { type BrowseFoldersRequest, BrowseFoldersRequestSchema } from "@eitri/contracts/folder";
import * as Schema from "effect/Schema";

const decodeRequest = Schema.decodeUnknownSync(BrowseFoldersRequestSchema);

const sentence = (error: unknown) =>
  new Error(String(error instanceof Error ? error.message : error).split("\n")[0]);

export function toBrowseFoldersRequest(path?: string): BrowseFoldersRequest {
  try {
    return decodeRequest(path === undefined ? {} : { path });
  } catch (error: unknown) {
    throw sentence(error);
  }
}
