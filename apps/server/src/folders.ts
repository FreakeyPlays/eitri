import { access, constants, readdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { FolderEntry, FolderListing } from "@eitri/contracts/folder";
import { Data, Effect } from "effect";

const MAX_FOLDER_ENTRIES = 500;
const MAX_FOLDER_READS = 32;

export class FoldersError extends Data.TaggedError("FoldersError")<{
  readonly message: string;
  readonly status: number;
}> {}

const reason = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const codeOf = (cause: unknown) =>
  typeof cause === "object" && cause !== null && "code" in cause
    ? String((cause as { code: unknown }).code)
    : undefined;

const expandHome = (path: string | undefined, home: string) => {
  if (path === undefined || path === "~") return home;
  return path.startsWith("~/") || path.startsWith("~\\") ? resolve(home, path.slice(2)) : path;
};

const browseError = (path: string, cause: unknown) => {
  const code = codeOf(cause);
  if (code === "ENOENT") {
    return new FoldersError({ message: `“${path}” does not exist.`, status: 400 });
  }
  if (code === "ENOTDIR") {
    return new FoldersError({ message: `“${path}” is not a folder.`, status: 400 });
  }
  if (code === "EACCES" || code === "EPERM") {
    return new FoldersError({ message: `Eitri may not browse “${path}”.`, status: 400 });
  }
  return new FoldersError({
    message: `Could not browse “${path}”. ${reason(cause)}`,
    status: 400,
  });
};

const readableDirectory = async (path: string, name: string): Promise<FolderEntry | null> => {
  try {
    const childPath = await realpath(join(path, name));
    const child = await stat(childPath);
    if (!child.isDirectory()) return null;
    await access(childPath, constants.R_OK | constants.X_OK);
    return { name, path: childPath };
  } catch {
    // One broken or unreadable child must not make its parent unusable.
    return null;
  }
};

/**
 * Lists one directory on the server. Child links are followed one level and
 * returned under their visible name with their canonical destination path.
 */
export const listFolders = (
  requestedPath?: string,
  options: { readonly home?: string; readonly limit?: number } = {},
): Effect.Effect<FolderListing, FoldersError> =>
  Effect.tryPromise({
    try: async () => {
      const input = expandHome(requestedPath, options.home ?? homedir());
      const path = await realpath(input);
      const info = await stat(path);
      if (!info.isDirectory()) {
        throw Object.assign(new Error(`${path} is not a directory`), { code: "ENOTDIR" });
      }
      await access(path, constants.R_OK | constants.X_OK);

      const entries = await readdir(path, { withFileTypes: true });
      const candidates = entries.filter(
        (entry) => !entry.name.startsWith(".") && (entry.isDirectory() || entry.isSymbolicLink()),
      );
      const children: Array<FolderEntry | null> = Array.from(
        { length: candidates.length },
        () => null,
      );
      let next = 0;
      const worker = async () => {
        while (next < candidates.length) {
          const index = next++;
          children[index] = await readableDirectory(path, candidates[index].name);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(MAX_FOLDER_READS, candidates.length) }, worker),
      );
      const directories = children
        .filter((entry): entry is FolderEntry => entry !== null)
        .sort((left, right) => (left.name === right.name ? 0 : left.name < right.name ? -1 : 1));
      const limit = Math.max(0, options.limit ?? MAX_FOLDER_ENTRIES);
      const parent = dirname(path);

      return {
        path,
        parentPath: parent === path ? null : parent,
        directories: directories.slice(0, limit),
        truncated: directories.length > limit,
      };
    },
    catch: (cause) => browseError(requestedPath ?? options.home ?? homedir(), cause),
  });
