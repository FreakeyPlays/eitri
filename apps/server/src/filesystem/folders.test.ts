import { chmod, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { FoldersError } from "@eitri/contracts/folder";
import { folderProblem, listFolders, readableFolder } from "./folders.ts";

describe("server folder browser", () => {
  let root: string;

  const run = (path?: string, options?: { home?: string; limit?: number }) =>
    Effect.runPromise(listFolders(path, options));
  const failure = (path: string) =>
    Effect.runPromise(Effect.flip(listFolders(path))) as Promise<FoldersError>;

  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), "eitri-folders-")));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("starts at the supplied server home", async () => {
    expect(await run(undefined, { home: root })).toMatchObject({
      path: root,
      directories: [],
      truncated: false,
    });
    expect((await run("~", { home: root })).path).toBe(root);
  });

  it("returns immediate readable folders in deterministic order before truncating", async () => {
    await Promise.all([
      mkdir(join(root, "zeta")),
      mkdir(join(root, "alpha")),
      mkdir(join(root, "space ü")),
      writeFile(join(root, "notes.txt"), "not a folder"),
    ]);

    const listing = await run(root, { limit: 2 });

    expect(listing.directories.map((entry) => entry.name)).toEqual(["alpha", "space ü"]);
    expect(listing.directories.map((entry) => entry.path)).toEqual([
      join(root, "alpha"),
      join(root, "space ü"),
    ]);
    expect(listing.truncated).toBe(true);
  });

  it("follows folder links, preserves their visible name and ignores broken links", async () => {
    const destination = join(root, "destination");
    await mkdir(destination);
    await symlink(destination, join(root, "shortcut"));
    await symlink(join(root, "missing"), join(root, "broken"));

    const listing = await run(root);

    expect(listing.directories).toContainEqual({ name: "shortcut", path: destination });
    expect(listing.directories.some((entry) => entry.name === "broken")).toBe(false);
  });

  it("reports missing paths and files clearly", async () => {
    const file = join(root, "notes.txt");
    await writeFile(file, "text");

    await expect(failure(join(root, "missing"))).resolves.toMatchObject({
      _tag: "FoldersError",
      message: expect.stringContaining("does not exist"),
    });
    await expect(failure(file)).resolves.toMatchObject({
      _tag: "FoldersError",
      message: expect.stringContaining("not a folder"),
    });
  });

  it("names the server home when it cannot be browsed", async () => {
    const home = join(root, "missing-home");

    const error = await Effect.runPromise(Effect.flip(listFolders(undefined, { home })));

    expect(error.message).toBe(`“${home}” does not exist.`);
  });

  // Root reads any folder, so the permission check only shows up for a normal user.
  it.skipIf(process.getuid?.() === 0)(
    "says Eitri may not browse a folder it cannot read",
    async () => {
      const locked = join(root, "locked");
      await mkdir(locked);
      await chmod(locked, 0o000);

      try {
        expect((await failure(locked)).message).toBe(`Eitri may not browse “${locked}”.`);
      } finally {
        await chmod(locked, 0o755);
      }
    },
  );

  it("sorts every folder by name regardless of directory order", async () => {
    const names = ["delta", "Echo", "bravo", "7up", "alpha", "charlie", "foxtrot", "golf"];
    await Promise.all(names.map((name) => mkdir(join(root, name))));

    const listing = await run(root);

    expect(listing.directories.map((entry) => entry.name)).toEqual([...names].sort());
  });

  it("only reports truncation when folders were left out", async () => {
    await Promise.all([mkdir(join(root, "one")), mkdir(join(root, "two"))]);

    expect((await run(root, { limit: 2 })).truncated).toBe(false);
    expect((await run(root, { limit: 1 })).truncated).toBe(true);
    expect(await run(root, { limit: 0 })).toMatchObject({ directories: [], truncated: true });
  });

  it("hides names starting with two dots but keeps other dotted folders", async () => {
    await Promise.all(["..hidden", ".config", "trailing.."].map((name) => mkdir(join(root, name))));

    const listing = await run(root);

    expect(listing.directories.map((entry) => entry.name)).toEqual([".config", "trailing.."]);
  });

  describe("home shortcuts", () => {
    let home: string;

    beforeEach(async () => {
      home = join(root, "home");
      await mkdir(join(home, "work"), { recursive: true });
    });

    it.each(["~/work", "~\\work"])("expands %s against the supplied home", async (path) => {
      expect((await run(path, { home })).path).toBe(join(home, "work"));
    });

    it("expands a lone ~/ to the home folder", async () => {
      expect((await run("~/", { home })).path).toBe(home);
    });

    it("does not treat a path that merely ends in ~/ as a home shortcut", async () => {
      const folder = join(root, "odd~");
      await mkdir(folder);

      expect((await run(`${folder}/`, { home })).path).toBe(folder);
    });
  });
});

describe("readableFolder", () => {
  it("rejects a file with ENOTDIR and its canonical path", async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), "eitri-readable-")));
    try {
      const file = join(root, "notes.txt");
      await writeFile(file, "text");

      await expect(readableFolder(file)).rejects.toMatchObject({
        code: "ENOTDIR",
        message: `${file} is not a directory`,
      });
      await expect(readableFolder(root)).resolves.toBe(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("folderProblem", () => {
  it.each([
    ["ENOENT", "“/x” does not exist."],
    ["ENOTDIR", "“/x” is not a folder."],
    ["EACCES", "Eitri may not open “/x”."],
    ["EPERM", "Eitri may not open “/x”."],
  ])("explains %s", (code, expected) => {
    expect(folderProblem("/x", Object.assign(new Error("raw"), { code }), "open")).toBe(expected);
  });

  it.each([
    ["an error", new Error("boom"), "boom"],
    ["a string", "plain text", "plain text"],
    ["null", null, "null"],
    ["an object without a code", { detail: 1 }, "[object Object]"],
    ["an unknown code", Object.assign(new Error("odd"), { code: "EIO" }), "odd"],
  ])("falls back to the cause for %s", (_name, cause, reason) => {
    expect(folderProblem("/x", cause, "browse")).toBe(`Could not browse “/x”. ${reason}`);
  });
});
