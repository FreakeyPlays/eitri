import { Database } from "bun:sqlite";
import { mkdir, mkdtemp, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { makeProjectStore, type ProjectsError, type ProjectStore } from "./projects.ts";

describe("project store", () => {
  let root: string;
  let dataDir: string;
  let stores: ProjectStore[];

  const project = async (name: string) => {
    const path = join(root, name);
    await mkdir(path, { recursive: true });
    return path;
  };
  const makeStore = () => {
    const store = makeProjectStore(dataDir);
    stores.push(store);
    return store;
  };
  const run = <A>(effect: Effect.Effect<A, ProjectsError>) => Effect.runPromise(effect);
  const failure = <A>(effect: Effect.Effect<A, ProjectsError>): Promise<ProjectsError> =>
    Effect.runPromise(Effect.flip(effect));
  const inspect = <A>(read: (database: Database) => A) => {
    const database = new Database(join(dataDir, "state.sqlite"));
    try {
      return read(database);
    } finally {
      database.close(true);
    }
  };

  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), "eitri-projects-")));
    dataDir = join(root, "userdata");
    stores = [];
  });

  afterEach(async () => {
    await Promise.all(stores.map((store) => run(store.close).catch(() => undefined)));
    await rm(root, { recursive: true, force: true });
  });

  it("initializes an empty versioned database", async () => {
    expect(await run(makeStore().snapshot)).toEqual({ projects: [] });
    expect(
      inspect(
        (database) =>
          (database.query("PRAGMA user_version").get() as { user_version: number }).user_version,
      ),
    ).toBe(1);
  });

  it("preserves project IDs and ordering after close and reopen", async () => {
    const first = await project("first");
    const second = await project("second");
    const store = makeStore();
    const firstOpen = await run(store.open(first));
    await run(store.open(second));
    const reopened = await run(store.open(first));
    await run(store.close);

    const restarted = makeStore();
    const snapshot = await run(restarted.snapshot);
    expect(reopened.openedProjectId).toBe(firstOpen.openedProjectId);
    expect(snapshot.projects.map(({ path }) => path)).toEqual([first, second]);
    expect(snapshot.projects[0]?.id).toBe(firstOpen.openedProjectId);
  });

  it("canonicalizes a path before enforcing uniqueness", async () => {
    const path = await project("eitri");
    const link = join(root, "shortcut");
    await symlink(path, link);
    const store = makeStore();

    const direct = await run(store.open(path));
    const linked = await run(store.open(link));

    expect(linked.openedProjectId).toBe(direct.openedProjectId);
    expect(linked.projects).toHaveLength(1);
    expect(linked.projects[0]?.path).toBe(path);
  });

  it("does not evict old identities as the history grows", async () => {
    const paths = await Promise.all(
      Array.from({ length: 30 }, (_, index) => project(`project-${index}`)),
    );
    const store = makeStore();
    for (const path of paths) await run(store.open(path));

    expect((await run(store.snapshot)).projects).toHaveLength(paths.length);
  });

  it("names a project without touching its folder, and survives reopening", async () => {
    const path = await project("work");
    const store = makeStore();
    const { openedProjectId: id } = await run(store.open(path));

    const named = await run(store.rename(id, "Client portal"));
    expect(named.projects).toEqual([expect.objectContaining({ id, path, name: "Client portal" })]);

    // Reopening the same folder must not reset the chosen name.
    expect((await run(store.open(path))).projects[0]?.name).toBe("Client portal");
    await run(store.close);
    expect((await run(makeStore().snapshot)).projects[0]?.name).toBe("Client portal");
    await expect(stat(path)).resolves.toBeDefined();
  });

  it("follows the folder again once the name is cleared, and rejects unknown ids", async () => {
    const path = await project("work");
    const store = makeStore();
    const { openedProjectId: id } = await run(store.open(path));
    await run(store.rename(id, "Client portal"));

    // A name matching the folder is still a name the user chose, so it is stored.
    expect((await run(store.rename(id, "work"))).projects[0]?.name).toBe("work");
    expect(inspect((database) => database.query("SELECT name FROM projects").get())).toEqual({
      name: "work",
    });

    expect((await run(store.rename(id, ""))).projects[0]?.name).toBe("work");
    expect(inspect((database) => database.query("SELECT name FROM projects").get())).toEqual({
      name: null,
    });
    expect(
      await failure(store.rename("6f3f9d4c-25c4-4a4a-9f0e-3f4b2c1d7e88", "Anything")),
    ).toMatchObject({ status: 404 });
  });

  it("forgets only the record, and it stays forgotten after a restart", async () => {
    const path = await project("work");
    const store = makeStore();
    const { openedProjectId: id } = await run(store.open(path));

    expect(await run(store.forget(id))).toEqual({ projects: [] });
    await run(store.close);
    expect(await run(makeStore().snapshot)).toEqual({ projects: [] });
    await expect(stat(path)).resolves.toBeDefined();
  });
  it("rejects a future database version before writing", async () => {
    await mkdir(dataDir, { recursive: true });
    const database = new Database(join(dataDir, "state.sqlite"));
    database.exec(
      "CREATE TABLE future_data (value TEXT); INSERT INTO future_data VALUES ('keep');",
    );
    database.exec("PRAGMA user_version = 99");
    database.close(true);

    const error = await failure(makeStore().snapshot);
    expect(error.message).toContain("version 99");
    expect(inspect((current) => current.query("SELECT value FROM future_data").get())).toEqual({
      value: "keep",
    });
  });

  it("rejects a current version whose schema does not match", async () => {
    await mkdir(dataDir, { recursive: true });
    const database = new Database(join(dataDir, "state.sqlite"));
    database.exec(
      "CREATE TABLE projects (id TEXT PRIMARY KEY NOT NULL, path TEXT NOT NULL, last_opened_at TEXT NOT NULL, sort_order INTEGER NOT NULL)",
    );
    database.exec("PRAGMA user_version = 1");
    database.close(true);

    const error = await failure(makeStore().snapshot);
    expect(error.message).toContain("does not match schema version 1");
    expect(
      inspect((current) => current.query("SELECT count(*) AS count FROM projects").get()),
    ).toEqual({
      count: 0,
    });
  });

  it("coordinates concurrent writes from separate store instances", async () => {
    const paths = await Promise.all(["one", "two", "three", "four"].map(project));
    const first = makeStore();
    const second = makeStore();

    await Promise.all(
      paths.map((path, index) => run((index % 2 === 0 ? first : second).open(path))),
    );
    const [reopenedByFirst, reopenedBySecond] = await Promise.all([
      run(first.open(paths[0]!)),
      run(second.open(paths[0]!)),
    ]);

    expect((await run(first.snapshot)).projects.map(({ path }) => path).sort()).toEqual(
      [...paths].sort(),
    );
    expect(reopenedByFirst.openedProjectId).toBe(reopenedBySecond.openedProjectId);
  });

  it("reports invalid paths and a data directory it cannot use", async () => {
    const store = makeStore();
    expect(await failure(store.open(join(root, "missing")))).toMatchObject({ status: 400 });

    await writeFile(dataDir, "not a directory");
    const error = await failure(makeStore().snapshot);
    expect(error.status).toBe(500);
    expect(error.message).toContain(join(dataDir, "state.sqlite"));
  });

  it("closes the connection and refuses later operations", async () => {
    const store = makeStore();
    await run(store.ready);
    await run(store.close);

    expect(await failure(store.snapshot)).toMatchObject({
      status: 500,
      message: "The project database is closed.",
    });
  });
});
