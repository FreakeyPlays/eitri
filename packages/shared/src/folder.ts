import {
  BrowseFoldersFailureSchema,
  type BrowseFoldersRequest,
  BrowseFoldersRequestSchema,
  type FolderListing,
  FolderListingSchema,
} from "@eitri/contracts/folder";
import * as Schema from "effect/Schema";

const decodeRequest = Schema.decodeUnknownSync(BrowseFoldersRequestSchema);
const decodeListing = Schema.decodeUnknownSync(FolderListingSchema);
const decodeFailure = Schema.decodeUnknownSync(BrowseFoldersFailureSchema);

const sentence = (error: unknown) =>
  new Error(String(error instanceof Error ? error.message : error).split("\n")[0]);

export function toBrowseFoldersRequest(path?: string): BrowseFoldersRequest {
  try {
    return decodeRequest(path === undefined ? {} : { path });
  } catch (error: unknown) {
    throw sentence(error);
  }
}

export function readFolderListing(reply: unknown): FolderListing {
  try {
    return decodeListing(reply);
  } catch {
    throw new Error("Unexpected response from the folder browser.");
  }
}

export function readBrowseFoldersFailure(reply: unknown): string {
  try {
    return decodeFailure(reply);
  } catch {
    return "The folder browser refused the request.";
  }
}
