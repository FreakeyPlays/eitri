import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { FoldersError } from "@eitri/contracts/folder";
import { listFolders } from "./folders.ts";

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
});
