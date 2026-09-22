import { access, constants, readdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { type FolderEntry, type FolderListing, FoldersError } from "@eitri/contracts/folder";
import { Effect } from "effect";

const MAX_FOLDER_ENTRIES = 500;
const MAX_FOLDER_READS = 32;

const reason = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const codeOf = (cause: unknown) =>
  typeof cause === "object" && cause !== null && "code" in cause
    ? String((cause as { code: unknown }).code)
    : undefined;

/**
 * The canonical path of a directory Eitri may read. Browsing and opening a project
 * both go through here; failures surface as the raw filesystem error for `folderProblem`.
 */
export const readableFolder = async (path: string) => {
  const canonical = await realpath(path);
  if (!(await stat(canonical)).isDirectory()) {
    throw Object.assign(new Error(`${canonical} is not a directory`), { code: "ENOTDIR" });
  }
  await access(canonical, constants.R_OK | constants.X_OK);
  return canonical;
};

/** Why `path` could not be browsed or opened, as one sentence the user can act on. */
export const folderProblem = (path: string, cause: unknown, action: "browse" | "open") => {
  const code = codeOf(cause);
  if (code === "ENOENT") return `“${path}” does not exist.`;
  if (code === "ENOTDIR") return `“${path}” is not a folder.`;
  if (code === "EACCES" || code === "EPERM") return `Eitri may not ${action} “${path}”.`;
  return `Could not ${action} “${path}”. ${reason(cause)}`;
};

const expandHome = (path: string | undefined, home: string) => {
  if (path === undefined || path === "~") return home;
  return path.startsWith("~/") || path.startsWith("~\\") ? resolve(home, path.slice(2)) : path;
};

const readableDirectory = async (path: string, name: string): Promise<FolderEntry | null> => {
  try {
    return { name, path: await readableFolder(join(path, name)) };
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
      const path = await readableFolder(expandHome(requestedPath, options.home ?? homedir()));

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

      return {
        path,
        directories: directories.slice(0, limit),
        truncated: directories.length > limit,
      };
    },
    catch: (cause) =>
      new FoldersError({
        message: folderProblem(requestedPath ?? options.home ?? homedir(), cause, "browse"),
      }),
  });
