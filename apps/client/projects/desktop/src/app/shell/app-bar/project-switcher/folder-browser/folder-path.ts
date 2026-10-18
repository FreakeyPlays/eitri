import type { FolderListing } from "@eitri/contracts/folder";

/**
 * Path rules of the folder browser's field. Paths stay as the user typed them,
 * with "/" or "\" separators, "~" for home, and roots like "/" and "C:\".
 */

const separatorIndex = (value: string) => Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));

/** The folder a typed path points at: everything up to and including its last separator. */
export const folderPart = (value: string) => value.slice(0, separatorIndex(value) + 1);

/** What the user typed after the last separator, used to filter the listing. */
export const filterPart = (value: string) => value.slice(separatorIndex(value) + 1).trim();

/** Ends `path` with a separator, using "\" when the path already does. */
export const withSeparator = (path: string) =>
  separatorIndex(path) === path.length - 1 ? path : path + (path.includes("\\") ? "\\" : "/");

/** Drops the trailing separator the field carries, keeping roots like "/", "~" and "C:\" intact. */
export const requestPath = (folder: string) => {
  const trimmed = folder.trim().replace(/[\\/]+$/, "");
  return trimmed === "" || trimmed.endsWith(":") ? folder.trim() : trimmed;
};

/** The folder above `folder` as the user would type it, or null at a root or at "~/". */
export const parentOf = (folder: string) => {
  const trimmed = folder.replace(/[\\/]+$/, "");
  const index = separatorIndex(trimmed);
  return index < 0 ? null : trimmed.slice(0, index + 1);
};

/** Prefix matches first, then names that merely contain the filter. Dot folders only on request. */
export const matching = (directories: FolderListing["directories"], filter: string) => {
  const needle = filter.toLocaleLowerCase();
  const visible = needle.startsWith(".")
    ? directories
    : directories.filter((directory) => !directory.name.startsWith("."));
  if (needle === "") return visible;
  const lower = (name: string) => name.toLocaleLowerCase();
  return [
    ...visible.filter((directory) => lower(directory.name).startsWith(needle)),
    ...visible.filter(
      (directory) =>
        !lower(directory.name).startsWith(needle) && lower(directory.name).includes(needle),
    ),
  ];
};
