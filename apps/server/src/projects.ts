import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { Database } from "bun:sqlite";
import type { OpenedProject, Project, Projects } from "@eitri/contracts/project";
import { Data, Effect, Semaphore } from "effect";
import { folderProblem, readableFolder } from "./folders.ts";

const DATABASE_VERSION = 1;
const BUSY_TIMEOUT_MS = 2_000;

export class ProjectsError extends Data.TaggedError("ProjectsError")<{
  message: string;
  status: number;
}> {}

export interface ProjectStore {
  readonly ready: Effect.Effect<void, ProjectsError>;
  readonly snapshot: Effect.Effect<Projects, ProjectsError>;
  readonly open: (path: string) => Effect.Effect<OpenedProject, ProjectsError>;
  readonly forget: (id: string) => Effect.Effect<Projects, ProjectsError>;
  readonly rename: (id: string, name: string) => Effect.Effect<Projects, ProjectsError>;
  readonly close: Effect.Effect<void, ProjectsError>;
}

const reason = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));
const displayName = (path: string) => basename(path) || path;

const validateCurrentSchema = (db: Database, file: string) => {
  const columns = db.query("PRAGMA table_info(projects)").all() as Array<{
    name: string;
    type: string;
    notnull: number;
    pk: number;
  }>;
  const actualColumns = columns.map(({ name, type, notnull, pk }) => ({
    name,
    type: type.toUpperCase(),
    notnull,
    pk,
  }));
  const expectedColumns = [
    { name: "id", type: "TEXT", notnull: 1, pk: 1 },
    { name: "path", type: "TEXT", notnull: 1, pk: 0 },
    { name: "name", type: "TEXT", notnull: 0, pk: 0 },
    { name: "last_opened_at", type: "TEXT", notnull: 1, pk: 0 },
    { name: "sort_order", type: "INTEGER", notnull: 1, pk: 0 },
  ];
  const indexes = db.query("PRAGMA index_list(projects)").all() as Array<{
    name: string;
    unique: number;
  }>;
  const hasUniquePath = indexes.some(
    (index) =>
      index.unique === 1 &&
      (
        db.query(`PRAGMA index_info("${index.name.replaceAll('"', '""')}")`).all() as Array<{
          name: string;
        }>
      )
        .map(({ name }) => name)
        .join(",") === "path",
  );
  if (JSON.stringify(actualColumns) !== JSON.stringify(expectedColumns) || !hasUniquePath) {
    throw new ProjectsError({
      message: `The project database at ${file} does not match schema version ${DATABASE_VERSION}. Restore it from backup or move it aside.`,
      status: 500,
    });
  }
};

/** SQLite-backed project identities owned by one server lifetime. */
export const makeProjectStore = (dataDir: string): ProjectStore => {
  const databaseFile = join(dataDir, "state.sqlite");
  const turns = Semaphore.makeUnsafe(1);
  let db: Database | undefined;
  let closed = false;

  const storageError = (cause: unknown) =>
    cause instanceof ProjectsError
      ? cause
      : new ProjectsError({
          message: `Could not use the project database at ${databaseFile}. ${reason(cause)}`,
          status: 500,
        });

  const initialize = async () => {
    if (closed)
      throw new ProjectsError({ message: "The project database is closed.", status: 500 });
    if (db) return db;

    let connection: Database | undefined;
    try {
      await mkdir(dataDir, { recursive: true });
      connection = new Database(databaseFile, { strict: true });
      const current = connection;
      current.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);

      // Checked under the write lock, so two servers starting at once create the schema once.
      const prepare = current.transaction(() => {
        const version = Number(
          (current.query("PRAGMA user_version").get() as { user_version: number }).user_version,
        );
        if (version > DATABASE_VERSION) {
          throw new ProjectsError({
            message: `The project database at ${databaseFile} uses schema version ${version}, but this Eitri supports version ${DATABASE_VERSION}. Upgrade Eitri before opening this data.`,
            status: 500,
          });
        }
        if (version === DATABASE_VERSION) {
          validateCurrentSchema(current, databaseFile);
          return;
        }
        const tables = current
          .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
          .all();
        if (tables.length > 0) {
          throw new ProjectsError({
            message: `The unversioned project database at ${databaseFile} is not empty. Move it aside before starting Eitri.`,
            status: 500,
          });
        }
        current.exec(`
          CREATE TABLE projects (
            id TEXT PRIMARY KEY NOT NULL,
            path TEXT NOT NULL UNIQUE,
            name TEXT,
            last_opened_at TEXT NOT NULL,
            sort_order INTEGER NOT NULL
          );
        `);
        current.exec(`PRAGMA user_version = ${DATABASE_VERSION}`);
      });
      prepare.immediate();
      db = current;
      return current;
    } catch (cause) {
      connection?.close(true);
      throw storageError(cause);
    }
  };

  const use = <A>(operation: (database: Database) => A) =>
    Semaphore.withPermit(turns)(
      Effect.tryPromise({
        try: async () => operation(await initialize()),
        catch: storageError,
      }),
    );

  /** A project shows the name the user chose, or its folder's name until one is chosen. */
  const list = (database: Database): Projects => ({
    projects: database
      .query(
        "SELECT id, path, name, last_opened_at AS lastOpenedAt FROM projects ORDER BY sort_order ASC",
      )
      .all()
      .map((row) => {
        const { name, ...project } = row as Omit<Project, "name"> & { name: string | null };
        return { ...project, name: name ?? displayName(project.path) };
      }),
  });

  const canonicalize = (path: string) =>
    Effect.tryPromise({
      try: () => readableFolder(path),
      catch: (cause) =>
        new ProjectsError({ message: folderProblem(path, cause, "open"), status: 400 }),
    });

  const ready = use(() => undefined);
  const snapshot = use(list);

  const open = (path: string) =>
    Effect.flatMap(canonicalize(path), (canonical) =>
      use((database) => {
        let openedProjectId = "";
        const mutate = database.transaction(() => {
          const existing = database
            .query("SELECT id FROM projects WHERE path = $path")
            .get({ path: canonical }) as { id: string } | null;
          openedProjectId = existing?.id ?? randomUUID();
          database.exec("UPDATE projects SET sort_order = sort_order + 1");
          database
            .query(
              // Reopening keeps whatever name the project already carries.
              `INSERT INTO projects (id, path, name, last_opened_at, sort_order)
               VALUES ($id, $path, NULL, $lastOpenedAt, 0)
               ON CONFLICT(path) DO UPDATE SET last_opened_at = excluded.last_opened_at, sort_order = 0`,
            )
            .run({ id: openedProjectId, path: canonical, lastOpenedAt: new Date().toISOString() });
        });
        mutate.immediate();
        return { ...list(database), openedProjectId };
      }),
    );

  const forget = (id: string) =>
    use((database) => {
      const mutate = database.transaction(() => {
        const result = database.query("DELETE FROM projects WHERE id = $id").run({ id });
        if (result.changes === 0) {
          throw new ProjectsError({ message: "That project is not in the list.", status: 404 });
        }
      });
      mutate.immediate();
      return list(database);
    });

  /** Names only this entry. An empty name clears it, so the project follows its folder again. */
  const rename = (id: string, name: string) =>
    use((database) => {
      const mutate = database.transaction(() => {
        const existing = database.query("SELECT id FROM projects WHERE id = $id").get({ id });
        if (!existing) {
          throw new ProjectsError({ message: "That project is not in the list.", status: 404 });
        }
        database
          .query("UPDATE projects SET name = $name WHERE id = $id")
          .run({ name: name === "" ? null : name, id });
      });
      mutate.immediate();
      return list(database);
    });

  const close = Semaphore.withPermit(turns)(
    Effect.try({
      try: () => {
        closed = true;
        db?.close(true);
        db = undefined;
      },
      catch: storageError,
    }),
  );

  return { ready, snapshot, open, forget, rename, close };
};
