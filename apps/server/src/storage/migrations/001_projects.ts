import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/**
 * The remembered projects. `IF NOT EXISTS` adopts databases created before
 * migrations were tracked, which already hold exactly this table.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      path TEXT NOT NULL UNIQUE,
      name TEXT,
      last_opened_at TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    )
  `;
});
