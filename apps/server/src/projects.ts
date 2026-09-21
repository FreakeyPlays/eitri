import { randomUUID } from "node:crypto";
import {
  access,
  constants,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, join } from "node:path";
import type { Projects } from "@eitri/contracts/project";
import { Data, Effect, Schema, Semaphore } from "effect";

/** Raising this forgets every remembered project instead of guessing at old data. */
const VERSION = 1;

/** Enough history for the picker to stay useful without growing without bound. */
const MAX_PROJECTS = 25;

/**
 * What one Eitri user collected across every project. Paths are canonical and
 * identify a project; names are derived when read, so a renamed folder shows its
 * new name.
 *
 * `lastProjectPath` is null when the user selected every project at once, and
 * otherwise stays put even when that folder is gone, so moving a project back
 * restores it.
 */
const RegistrySchema = Schema.Struct({
  version: Schema.Literal(VERSION),
  lastProjectPath: Schema.NullOr(Schema.String),
  projects: Schema.Array(Schema.Struct({ path: Schema.String, lastOpenedAt: Schema.String })),
});

type Registry = typeof RegistrySchema.Type;

const EMPTY: Registry = { version: VERSION, lastProjectPath: null, projects: [] };

const decodeRegistry = Schema.decodeUnknownEffect(RegistrySchema);
const encodeRegistry = Schema.encodeSync(RegistrySchema);

/** Every project failure the client is allowed to see, with the status it answers. */
export class ProjectsError extends Data.TaggedError("ProjectsError")<{
  message: string;
  status: number;
}> {}

export interface ProjectStore {
  /** Every project the user can return to, and what they selected. */
  readonly snapshot: Effect.Effect<Projects, ProjectsError>;
  /**
   * Selects the project rooted in `path` and remembers it as the most recent one,
   * or every project at once when `path` is null.
   */
  readonly select: (path: string | null) => Effect.Effect<Projects, ProjectsError>;
  /** Drops one project from the list. The directory itself is left alone. */
  readonly forget: (path: string) => Effect.Effect<Projects, ProjectsError>;
}

const reason = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const codeOf = (cause: unknown) =>
  typeof cause === "object" && cause !== null && "code" in cause
    ? String((cause as { code: unknown }).code)
    : undefined;

/** The folder's own name, or the whole path for a filesystem root that has none. */
const displayName = (path: string) => basename(path) || path;

/**
 * Remembers the projects of one user in a single JSON file.
 *
 * `dataDir` is always passed in: the caller decides whether this is the
 * installed app's data, a development copy or a throwaway directory. Reads and
 * writes take turns, so a switch that arrives mid-write cannot lose the other's
 * entry. Two backends sharing one directory still can; nothing here coordinates
 * across processes, and the desktop app runs a single backend.
 */
export const makeProjectStore = (dataDir: string): ProjectStore => {
  const file = join(dataDir, "projects.json");
  const turns = Semaphore.makeUnsafe(1);

  const unreadable = (cause: unknown) =>
    new ProjectsError({
      message: `Could not read the project list at ${file}. ${reason(cause)}`,
      status: 500,
    });

  const malformed = new ProjectsError({
    message: `The project list at ${file} could not be understood. Move the file aside to start with an empty list.`,
    status: 500,
  });

  const readRegistry = Effect.gen(function* () {
    const contents = yield* Effect.tryPromise({
      try: () =>
        readFile(file, "utf8").catch((cause: unknown) => {
          // No file yet is the ordinary first start, not a failure.
          if (codeOf(cause) === "ENOENT") return null;
          throw cause;
        }),
      catch: unreadable,
    });
    if (contents === null) return EMPTY;
    const parsed = yield* Effect.try({
      try: () => JSON.parse(contents) as unknown,
      catch: () => malformed,
    });
    // A file we cannot read is never overwritten; the user decides what happens to it.
    return yield* decodeRegistry(parsed).pipe(Effect.mapError(() => malformed));
  });

  const write = (registry: Registry) =>
    Effect.tryPromise({
      try: async () => {
        await mkdir(dataDir, { recursive: true });
        // Writing beside the file and renaming it leaves no half-written list behind.
        const temporary = `${file}.${randomUUID()}.tmp`;
        try {
          await writeFile(temporary, `${JSON.stringify(encodeRegistry(registry), null, 2)}\n`);
          await rename(temporary, file);
        } catch (cause) {
          await rm(temporary, { force: true });
          throw cause;
        }
      },
      catch: (cause) =>
        new ProjectsError({
          message: `Could not save the project list to ${file}. ${reason(cause)}`,
          status: 500,
        }),
    });

  const toProjects = (
    registry: Registry,
    activePath: string | null,
    notice: string | null,
  ): Projects => ({
    projects: registry.projects.map((entry) => ({ ...entry, name: displayName(entry.path) })),
    activePath,
    notice,
  });

  const isDirectory = (path: string) =>
    Effect.promise(() =>
      stat(path).then(
        (entry) => entry.isDirectory(),
        () => false,
      ),
    );

  /** Resolves what the user picked, so links and `..` cannot hide a duplicate. */
  const canonicalize = (path: string) =>
    Effect.tryPromise({
      try: async () => {
        const canonical = await realpath(path);
        if (!(await stat(canonical)).isDirectory()) {
          throw Object.assign(new Error(`${canonical} is not a directory`), { code: "ENOTDIR" });
        }
        await access(canonical, constants.R_OK | constants.X_OK);
        return canonical;
      },
      catch: (cause) => {
        const code = codeOf(cause);
        if (code === "ENOENT") {
          return new ProjectsError({ message: `“${path}” does not exist.`, status: 400 });
        }
        if (code === "ENOTDIR") {
          return new ProjectsError({ message: `“${path}” is not a folder.`, status: 400 });
        }
        if (code === "EACCES" || code === "EPERM") {
          return new ProjectsError({ message: `Eitri may not open “${path}”.`, status: 400 });
        }
        return new ProjectsError({
          message: `Could not open “${path}”. ${reason(cause)}`,
          status: 400,
        });
      },
    });

  const snapshot = Effect.gen(function* () {
    const registry = yield* readRegistry;
    const last = registry.lastProjectPath;
    if (last === null) return toProjects(registry, null, null);
    // Only the project that would open now is checked; the rest stay untouched
    // until the user picks one, so a detached drive costs nothing to start up.
    return (yield* isDirectory(last))
      ? toProjects(registry, last, null)
      : toProjects(
          registry,
          null,
          `“${displayName(last)}” is no longer at ${last}. Open it again from its new location.`,
        );
  });

  /** Selecting every project keeps the list untouched; it only widens the view. */
  const selectAll = Effect.gen(function* () {
    const registry = yield* readRegistry;
    const next: Registry = { ...registry, lastProjectPath: null };
    yield* write(next);
    return toProjects(next, null, null);
  });

  const selectProject = (path: string) =>
    Effect.gen(function* () {
      const canonical = yield* canonicalize(path);
      const registry = yield* readRegistry;
      const opened = { path: canonical, lastOpenedAt: new Date().toISOString() };
      const next: Registry = {
        version: VERSION,
        lastProjectPath: canonical,
        projects: [opened, ...registry.projects.filter((entry) => entry.path !== canonical)].slice(
          0,
          MAX_PROJECTS,
        ),
      };
      yield* write(next);
      // Only a saved project is reported as open, so a restart shows the same thing.
      return toProjects(next, canonical, null);
    });

  const forget = (path: string) =>
    Effect.gen(function* () {
      const registry = yield* readRegistry;
      const projects = registry.projects.filter((entry) => entry.path !== path);
      if (projects.length === registry.projects.length) {
        return yield* new ProjectsError({
          message: `“${displayName(path)}” is not in the list.`,
          status: 404,
        });
      }
      // Forgetting what was selected widens the view rather than picking for the user.
      const next: Registry = {
        version: VERSION,
        lastProjectPath: registry.lastProjectPath === path ? null : registry.lastProjectPath,
        projects,
      };
      yield* write(next);
      return toProjects(next, next.lastProjectPath, null);
    });

  return {
    snapshot: Semaphore.withPermit(turns)(snapshot),
    select: (path) => Semaphore.withPermit(turns)(path === null ? selectAll : selectProject(path)),
    forget: (path) => Semaphore.withPermit(turns)(forget(path)),
  };
};
