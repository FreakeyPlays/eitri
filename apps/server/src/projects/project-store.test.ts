import { Database as Sqlite } from "bun:sqlite";
import { mkdir, mkdtemp, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Database } from "../storage/database.ts";
import { ProjectStore } from "./project-store.ts";

describe("project store", () => {
  let root: string;
  let dataDir: string;

  const project = async (name: string) => {
    const path = join(root, name);
    await mkdir(path, { recursive: true });
    return path;
  };
  /** Opens the database, runs `use` against one store, and closes it again, like one server run. */
  const withStore = <A, E>(use: (store: ProjectStore["Service"]) => Effect.Effect<A, E>) =>
    Effect.flatMap(ProjectStore, use).pipe(
      Effect.provide(ProjectStore.layer.pipe(Layer.provide(Database(dataDir)))),
    );
  const run = <A, E>(use: (store: ProjectStore["Service"]) => Effect.Effect<A, E>) =>
    Effect.runPromise(withStore(use));
  const failure = <A, E>(use: (store: ProjectStore["Service"]) => Effect.Effect<A, E>) =>
    Effect.runPromise(Effect.flip(withStore(use)));
  /** Reads the file directly, read-only, the way a developer would inspect it. */
  const inspect = <A>(read: (database: Sqlite) => A) => {
    const database = new Sqlite(join(dataDir, "state.sqlite"), { readonly: true });
    try {
      return read(database);
    } finally {
      database.close(true);
    }
  };
  /** A database file prepared by hand before any server opens it. */
  const prepare = async (statements: string) => {
    await mkdir(dataDir, { recursive: true });
    const database = new Sqlite(join(dataDir, "state.sqlite"));
    database.exec(statements);
    database.close(true);
  };

  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), "eitri-projects-")));
    dataDir = join(root, "userdata");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("creates the database and records the migrations it ran", async () => {
    expect(await run((store) => store.snapshot)).toEqual({ projects: [] });
    expect(
      inspect((database) =>
        database.query("SELECT migration_id, name FROM effect_sql_migrations").all(),
      ),
    ).toEqual([{ migration_id: 1, name: "projects" }]);
  });

  it("preserves project IDs and ordering after close and reopen", async () => {
    const first = await project("first");
    const second = await project("second");
    const [firstOpen, reopened] = await run((store) =>
      Effect.gen(function* () {
        const opened = yield* store.open(first);
        yield* store.open(second);
        return [opened, yield* store.open(first)] as const;
      }),
    );

    const snapshot = await run((store) => store.snapshot);
    expect(reopened.openedProjectId).toBe(firstOpen.openedProjectId);
    expect(snapshot.projects.map(({ path }) => path)).toEqual([first, second]);
    expect(snapshot.projects[0]?.id).toBe(firstOpen.openedProjectId);
  });

  it("canonicalizes a path before enforcing uniqueness", async () => {
    const path = await project("eitri");
    const link = join(root, "shortcut");
    await symlink(path, link);

    const [direct, linked] = await run((store) => Effect.all([store.open(path), store.open(link)]));

    expect(linked.openedProjectId).toBe(direct.openedProjectId);
    expect(linked.projects).toHaveLength(1);
    expect(linked.projects[0]?.path).toBe(path);
  });

  it("does not evict old identities as the history grows", async () => {
    const paths = await Promise.all(
      Array.from({ length: 30 }, (_, index) => project(`project-${index}`)),
    );
    const snapshot = await run((store) =>
      Effect.andThen(Effect.forEach(paths, store.open), store.snapshot),
    );

    expect(snapshot.projects).toHaveLength(paths.length);
  });

  it("names a project without touching its folder, and survives reopening", async () => {
    const path = await project("work");
    const { openedProjectId: id } = await run((store) => store.open(path));

    const named = await run((store) => store.rename(id, "Client portal"));
    expect(named.projects).toEqual([expect.objectContaining({ id, path, name: "Client portal" })]);

    // Reopening the same folder must not reset the chosen name.
    expect((await run((store) => store.open(path))).projects[0]?.name).toBe("Client portal");
    expect((await run((store) => store.snapshot)).projects[0]?.name).toBe("Client portal");
    await expect(stat(path)).resolves.toBeDefined();
  });

  it("follows the folder again once the name is cleared, and rejects unknown ids", async () => {
    const path = await project("work");
    const { openedProjectId: id } = await run((store) => store.open(path));
    await run((store) => store.rename(id, "Client portal"));

    // A name matching the folder is still a name the user chose, so it is stored.
    expect((await run((store) => store.rename(id, "work"))).projects[0]?.name).toBe("work");
    expect(inspect((database) => database.query("SELECT name FROM projects").get())).toEqual({
      name: "work",
    });

    expect((await run((store) => store.rename(id, ""))).projects[0]?.name).toBe("work");
    expect(inspect((database) => database.query("SELECT name FROM projects").get())).toEqual({
      name: null,
    });
    expect(
      await failure((store) => store.rename("6f3f9d4c-25c4-4a4a-9f0e-3f4b2c1d7e88", "Anything")),
    ).toMatchObject({ _tag: "ProjectsError", message: "That project is not in the list." });
  });

  it("forgets only the record, and it stays forgotten after a restart", async () => {
    const path = await project("work");
    const { openedProjectId: id } = await run((store) => store.open(path));

    expect(await run((store) => store.forget(id))).toEqual({ projects: [] });
    expect(await run((store) => store.snapshot)).toEqual({ projects: [] });
    expect(await failure((store) => store.forget(id))).toMatchObject({ _tag: "ProjectsError" });
    await expect(stat(path)).resolves.toBeDefined();
  });

  it("adopts a database from before migrations were tracked", async () => {
    await prepare(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY NOT NULL,
        path TEXT NOT NULL UNIQUE,
        name TEXT,
        last_opened_at TEXT NOT NULL,
        sort_order INTEGER NOT NULL
      );
      INSERT INTO projects VALUES ('ca0dcace-34da-4b44-8364-13ce54a32e44', '/git/eitri', NULL, '2026-09-21T10:00:00.000Z', 0);
      PRAGMA user_version = 1;
    `);

    expect(await run((store) => store.snapshot)).toMatchObject({
      projects: [{ id: "ca0dcace-34da-4b44-8364-13ce54a32e44", path: "/git/eitri" }],
    });
  });

  it("refuses a database from a newer Eitri without writing to it", async () => {
    await prepare(`
      CREATE TABLE effect_sql_migrations (
        migration_id integer PRIMARY KEY NOT NULL,
        created_at datetime NOT NULL DEFAULT current_timestamp,
        name VARCHAR(255) NOT NULL
      );
      INSERT INTO effect_sql_migrations (migration_id, name) VALUES (1, 'projects'), (99, 'future');
      CREATE TABLE future_data (value TEXT);
      INSERT INTO future_data VALUES ('keep');
    `);

    const error = await failure((store) => store.snapshot);
    expect(error).toMatchObject({ _tag: "DatabaseError" });
    expect(error.message).toContain("newer Eitri");
    expect(inspect((database) => database.query("SELECT value FROM future_data").get())).toEqual({
      value: "keep",
    });
    expect(
      inspect((database) =>
        database.query("SELECT name FROM sqlite_master WHERE name = 'projects'").get(),
      ),
    ).toBeNull();
  });

  it("coordinates concurrent writes from separate connections", async () => {
    const paths = await Promise.all(["one", "two", "three", "four"].map(project));

    await Promise.all(paths.map((path) => run((store) => store.open(path))));
    const [reopenedByFirst, reopenedBySecond] = await Promise.all([
      run((store) => store.open(paths[0]!)),
      run((store) => store.open(paths[0]!)),
    ]);

    expect((await run((store) => store.snapshot)).projects.map(({ path }) => path).sort()).toEqual(
      [...paths].sort(),
    );
    expect(reopenedByFirst.openedProjectId).toBe(reopenedBySecond.openedProjectId);
  });

  it("reports invalid paths and a data directory it cannot use", async () => {
    expect(await failure((store) => store.open(join(root, "missing")))).toMatchObject({
      _tag: "ProjectsError",
      message: expect.stringContaining("does not exist"),
    });

    await rm(dataDir, { recursive: true, force: true });
    await writeFile(dataDir, "not a directory");
    const error = await failure((store) => store.snapshot);
    expect(error).toMatchObject({ _tag: "DatabaseError" });
    expect(error.message).toContain(join(dataDir, "state.sqlite"));
  });
});
