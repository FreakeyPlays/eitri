import { mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { makeProjectStore, type ProjectsError } from "./projects.ts";

/**
 * Every test gets its own throwaway directory: the installed app's project list
 * is the developer's real data and is never opened here.
 */
describe("project store", () => {
  let root: string;
  let dataDir: string;
  let store: ReturnType<typeof makeProjectStore>;

  const project = async (name: string) => {
    const path = join(root, name);
    await mkdir(path, { recursive: true });
    return path;
  };

  const registry = () => readFile(join(dataDir, "projects.json"), "utf8");
  const run = <A>(effect: Effect.Effect<A, ProjectsError>) => Effect.runPromise(effect);
  /** Swaps the channels, so a refusal the store meant to send becomes the result. */
  const failure = <A>(effect: Effect.Effect<A, ProjectsError>): Promise<ProjectsError> =>
    Effect.runPromise(Effect.flip(effect));

  beforeEach(async () => {
    // Canonical from the start: a temporary directory is a symlink on macOS.
    root = await realpath(await mkdtemp(join(tmpdir(), "eitri-projects-")));
    dataDir = join(root, "userdata");
    store = makeProjectStore(dataDir);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("reads an empty list before anything was opened, without creating a file", async () => {
    expect(await run(store.snapshot)).toEqual({ projects: [], activePath: null, notice: null });
    await expect(registry()).rejects.toThrow();
  });

  it("opens a project and remembers it for the next start", async () => {
    const path = await project("eitri");

    const opened = await run(store.select(path));
    expect(opened).toEqual({
      projects: [{ path, name: "eitri", lastOpenedAt: expect.any(String) }],
      activePath: path,
      notice: null,
    });
    expect(await run(makeProjectStore(dataDir).snapshot)).toMatchObject({ activePath: path });
  });

  it("puts the project the user switched to in front", async () => {
    const first = await project("first");
    const second = await project("second");

    await run(store.select(first));
    const switched = await run(store.select(second));

    expect(switched.projects.map((entry) => entry.name)).toEqual(["second", "first"]);
    expect(switched.activePath).toBe(second);
  });

  it("keeps one entry per project, however it was reached", async () => {
    const path = await project("eitri");
    const link = join(root, "shortcut");
    await symlink(path, link);

    await run(store.select(path));
    const reopened = await run(store.select(join(path, "..", "eitri")));
    const linked = await run(store.select(link));

    expect(reopened.projects).toHaveLength(1);
    expect(linked.projects).toHaveLength(1);
    expect(linked.activePath).toBe(path);
  });

  it("lists the project that moved away, but opens nothing", async () => {
    const path = await project("moved");
    await run(store.select(path));
    await rm(path, { recursive: true, force: true });

    const snapshot = await run(store.snapshot);

    expect(snapshot.activePath).toBeNull();
    expect(snapshot.notice).toContain(path);
    expect(snapshot.projects.map((entry) => entry.path)).toEqual([path]);
    // The user decides when to forget it; a temporary absence is not a deletion.
    expect(await registry()).toContain(path);
  });

  it("reopens a project that came back", async () => {
    const path = await project("away");
    await run(store.select(path));
    await rm(path, { recursive: true, force: true });
    expect(await run(store.snapshot)).toMatchObject({ activePath: null });

    await mkdir(path, { recursive: true });

    expect(await run(store.snapshot)).toMatchObject({ activePath: path, notice: null });
  });

  it("selects every project at once without touching the list", async () => {
    const first = await project("first");
    const second = await project("second");
    await run(store.select(first));
    await run(store.select(second));

    const all = await run(store.select(null));

    expect(all.activePath).toBeNull();
    expect(all.notice).toBeNull();
    expect(all.projects.map((entry) => entry.name)).toEqual(["second", "first"]);
    // Survives a restart like any other selection.
    expect(await run(makeProjectStore(dataDir).snapshot)).toMatchObject({ activePath: null });
  });

  it("forgets one project and leaves the folder alone", async () => {
    const kept = await project("kept");
    const dropped = await project("dropped");
    await run(store.select(kept));
    await run(store.select(dropped));

    const remaining = await run(store.forget(kept));

    expect(remaining.projects.map((entry) => entry.name)).toEqual(["dropped"]);
    expect(remaining.activePath).toBe(dropped);
    expect(await run(store.snapshot)).toMatchObject({ activePath: dropped });
    await expect(stat(kept)).resolves.toBeDefined();
  });

  it("widens the view when the selected project is forgotten", async () => {
    const other = await project("other");
    const selected = await project("selected");
    await run(store.select(other));
    await run(store.select(selected));

    const remaining = await run(store.forget(selected));

    // Nothing is picked on the user's behalf; every project is shown instead.
    expect(remaining.activePath).toBeNull();
    expect(remaining.projects.map((entry) => entry.name)).toEqual(["other"]);
    expect(await run(makeProjectStore(dataDir).snapshot)).toMatchObject({ activePath: null });
  });

  it("forgets a project whose folder is already gone", async () => {
    const path = await project("gone");
    await run(store.select(path));
    await rm(path, { recursive: true, force: true });

    expect(await run(store.forget(path))).toEqual({
      projects: [],
      activePath: null,
      notice: null,
    });
  });

  it("refuses to forget a project it never listed", async () => {
    const error = await failure(store.forget(join(root, "never-opened")));

    expect(error.status).toBe(404);
    expect(error.message).toContain("not in the list");
  });

  it.each([
    { what: "a path that does not exist", path: "missing", expected: "does not exist" },
    { what: "a file", path: "notes.md", expected: "is not a folder" },
  ])("refuses $what", async ({ path, expected }) => {
    await mkdir(dataDir, { recursive: true });
    if (path === "notes.md") await writeFile(join(root, path), "text");

    const error = await failure(store.select(join(root, path)));

    expect(error.message).toContain(expected);
    expect(error.status).toBe(400);
  });

  it("refuses to guess at a list it cannot read, and leaves it alone", async () => {
    await mkdir(dataDir, { recursive: true });
    const file = join(dataDir, "projects.json");
    const path = await project("eitri");

    for (const contents of ["{", "[]", JSON.stringify({ version: 99, projects: [] })]) {
      await writeFile(file, contents);

      const read = await failure(store.snapshot);
      expect(read.status).toBe(500);
      expect(read.message).toContain(file);
      // Refusing to open is what protects the file: no write may replace it.
      expect(await failure(store.select(path))).toMatchObject({ status: 500 });
      expect(await readFile(file, "utf8")).toBe(contents);
    }
  });

  it("reports a data directory it cannot use, naming the file it tried", async () => {
    const path = await project("eitri");
    // A file where the data directory should be leaves nowhere to keep the list.
    await writeFile(dataDir, "not a directory");

    const error = await failure(store.select(path));

    expect(error.status).toBe(500);
    expect(error.message).toContain(join(dataDir, "projects.json"));
  });

  it("lets concurrent switches take turns instead of losing one", async () => {
    const paths = await Promise.all(["one", "two", "three", "four"].map((name) => project(name)));

    const results = await Effect.runPromise(
      Effect.all(
        paths.map((path) => store.select(path)),
        { concurrency: "unbounded" },
      ),
    );

    // Whichever finished last is the open one, but every project was recorded.
    const last = results[results.length - 1];
    expect(await run(store.snapshot)).toMatchObject({ activePath: last.activePath });
    expect(await run(store.snapshot)).toMatchObject({ projects: expect.any(Array) });
    const stored = (await run(store.snapshot)).projects.map((entry) => entry.path).sort();
    expect(stored).toEqual([...paths].sort());
  });

  it("writes the list as readable JSON, without leaving temporary files behind", async () => {
    const path = await project("eitri");
    await run(store.select(path));

    expect(JSON.parse(await registry())).toEqual({
      version: 1,
      lastProjectPath: path,
      projects: [{ path, lastOpenedAt: expect.any(String) }],
    });
    const { readdir } = await import("node:fs/promises");
    expect(await readdir(dataDir)).toEqual(["projects.json"]);
  });

  it("shows a renamed folder under its new name", async () => {
    const path = await project("old-name");
    await run(store.select(path));
    const renamed = join(root, "new-name");
    const { rename } = await import("node:fs/promises");
    await rename(path, renamed);

    expect((await run(store.select(renamed))).projects[0]).toMatchObject({ name: "new-name" });
  });
});
