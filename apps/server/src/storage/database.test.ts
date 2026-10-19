import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { Database } from "./database.ts";

describe("database", () => {
  it("includes the filesystem reason when the database directory is a file", async () => {
    const root = await mkdtemp(join(tmpdir(), "eitri-database-"));
    const dataDir = join(root, "userdata");
    try {
      await writeFile(dataDir, "not a directory");

      const error = await Effect.runPromise(
        Effect.void.pipe(Effect.provide(Database(dataDir)), Effect.flip),
      );

      expect(error).toMatchObject({ _tag: "DatabaseError" });
      expect(error.message).toContain(
        `Could not use the database at ${join(dataDir, "state.sqlite")}.`,
      );
      expect(error.message).toMatch(/EEXIST|ENOTDIR/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
