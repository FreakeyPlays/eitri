import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import * as SqliteClient from "@effect/sql-sqlite-bun/SqliteClient";
import { Cause, Data, Effect, Layer } from "effect";
import { Migrator, SqlClient } from "effect/unstable/sql";
import Projects from "./migrations/001_projects.ts";

/**
 * Every schema change, one file each in `migrations/`, keyed `<id>_<name>`.
 * Add a file with the next id and list it here; never edit one that shipped,
 * because databases that already ran it would not see the edit. Imports stay
 * static so the compiled sidecar carries them.
 */
const migrations = { "1_projects": Projects };
const LATEST = Math.max(...Object.keys(migrations).map((key) => Number.parseInt(key, 10)));

class DatabaseError extends Data.TaggedError("DatabaseError")<{ message: string }> {}

const reason = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/** Applies what this database has not run yet, then refuses data from a newer Eitri. */
const migrate = (file: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* Migrator.make({})({ loader: Migrator.fromRecord(migrations) });
    const [{ latest }] = yield* sql<{ latest: number }>`
      SELECT max(migration_id) AS latest FROM effect_sql_migrations
    `;
    if (latest > LATEST) {
      return yield* new DatabaseError({
        message: `The database at ${file} was written by a newer Eitri (schema ${latest}, this one knows ${LATEST}). Upgrade Eitri before opening this data.`,
      });
    }
  });

/**
 * `state.sqlite` in the data directory, migrated before anything reads it and
 * closed with the layer. The client serializes access and runs explicit
 * transactions as `BEGIN IMMEDIATE`, so separate servers never overwrite each other.
 */
export const Database = (dataDir: string) => {
  const file = join(dataDir, "state.sqlite");
  return Layer.effectContext(
    Effect.gen(function* () {
      yield* Effect.promise(() => mkdir(dataDir, { recursive: true }));
      const database = yield* Layer.build(SqliteClient.layer({ filename: file }));
      yield* Effect.provide(migrate(file), database);
      return database;
    }).pipe(
      // Opening, creating and migrating can each fail as a defect; all of them mean the same to the user.
      Effect.catchCause((cause) => {
        const error = Cause.squash(cause);
        return Effect.fail(
          error instanceof DatabaseError
            ? error
            : new DatabaseError({
                message: `Could not use the database at ${file}. ${reason(error)}`,
              }),
        );
      }),
    ),
  );
};
