import * as Schema from "effect/Schema";

/** Route served by the backend for browsing its filesystem. */
export const FOLDERS_ENDPOINT = "/api/folders";

export const FOLDER_PATH_MESSAGE =
  "Enter an absolute folder path, or use ~ for the server home folder.";

const ABSOLUTE_PATH = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/;
const HOME_PATH = /^~(?:[\\/]|$)/;

const FolderPathSchema = Schema.String.check(
  Schema.makeFilter((path) =>
    ABSOLUTE_PATH.test(path) || HOME_PATH.test(path) ? undefined : FOLDER_PATH_MESSAGE,
  ),
);

/** An omitted path starts browsing at the server user's home folder. */
export const BrowseFoldersRequestSchema = Schema.Struct({
  path: Schema.optional(FolderPathSchema),
});

export type BrowseFoldersRequest = typeof BrowseFoldersRequestSchema.Type;

const FolderEntrySchema = Schema.Struct({
  name: Schema.String,
  path: Schema.String,
});

export type FolderEntry = typeof FolderEntrySchema.Type;

export const FolderListingSchema = Schema.Struct({
  path: Schema.String,
  parentPath: Schema.NullOr(Schema.String),
  directories: Schema.Array(FolderEntrySchema),
  truncated: Schema.Boolean,
});

export type FolderListing = typeof FolderListingSchema.Type;

/** A rejected browse request answers with a message in this shape. */
export const BrowseFoldersFailureSchema = Schema.String;
