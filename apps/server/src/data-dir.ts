import { join, resolve } from "node:path";

/** The installed app's data, in a folder of the user's own home directory. */
export const DATA_DIR = ".eitri";

/** Development keeps its data beside the installed app's, never inside it. */
export const DEV_DATA_DIR = ".eitri-dev";

const USERDATA = "userdata";

/**
 * Where the backend stores what the user collected across every project.
 *
 * `EITRI_DATA_DIR` wins, so tests and one-off runs stay away from real data, and
 * `--dev` keeps a working copy of its own. Only the executable resolves this:
 * every other caller is handed the directory, so no default can slip in.
 */
export function resolveDataDir(options: {
  readonly override: string | undefined;
  readonly dev: boolean;
  readonly home: string;
}): string {
  const override = options.override?.trim();
  if (override) return resolve(override);
  return join(options.home, options.dev ? DEV_DATA_DIR : DATA_DIR, USERDATA);
}
