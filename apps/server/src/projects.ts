import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { type OpenedProject, ProjectsError, type Projects } from "@eitri/contracts/project";
import { Context, Effect, Layer } from "effect";
import { SqlClient, type SqlError } from "effect/unstable/sql";
import { folderProblem, readableFolder } from "./folders.ts";

const displayName = (path: string) => basename(path) || path;

const notListed = new ProjectsError({ message: "That project is not in the list." });

/** Project identities in `state.sqlite`, shared by every client of this server. */
export class ProjectStore extends Context.Service<
  ProjectStore,
  {
    readonly snapshot: Effect.Effect<Projects, ProjectsError>;
    readonly open: (path: string) => Effect.Effect<OpenedProject, ProjectsError>;
    readonly forget: (id: string) => Effect.Effect<Projects, ProjectsError>;
    readonly rename: (id: string, name: string) => Effect.Effect<Projects, ProjectsError>;
  }
>()("eitri/ProjectStore") {
  static readonly layer = Layer.effect(
    ProjectStore,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const unusable = (error: SqlError.SqlError) =>
        new ProjectsError({ message: `Could not use the project database. ${error.message}` });

      /** Every write runs as one immediate transaction and answers with the list it left. */
      const transaction = <A>(effect: Effect.Effect<A, ProjectsError | SqlError.SqlError>) =>
        sql
          .withTransaction(effect)
          .pipe(Effect.catchTag("SqlError", (error) => Effect.fail(unusable(error))));

      /** A project shows the name the user chose, or its folder's name until one is chosen. */
      const list = Effect.map(
        sql<{ id: string; path: string; name: string | null; lastOpenedAt: string }>`
          SELECT id, path, name, last_opened_at AS lastOpenedAt FROM projects ORDER BY sort_order ASC
        `,
        (rows): Projects => ({
          projects: rows.map(({ name, ...project }) => ({
            ...project,
            name: name ?? displayName(project.path),
          })),
        }),
      );

      const canonicalize = (path: string) =>
        Effect.tryPromise({
          try: () => readableFolder(path),
          catch: (cause) => new ProjectsError({ message: folderProblem(path, cause, "open") }),
        });

      const open = (path: string) =>
        Effect.flatMap(canonicalize(path), (canonical) =>
          transaction(
            Effect.gen(function* () {
              const [existing] = yield* sql<{ id: string }>`
                SELECT id FROM projects WHERE path = ${canonical}
              `;
              const openedProjectId = existing?.id ?? randomUUID();
              yield* sql`UPDATE projects SET sort_order = sort_order + 1`;
              // Reopening keeps whatever name the project already carries.
              yield* sql`
                INSERT INTO projects (id, path, name, last_opened_at, sort_order)
                VALUES (${openedProjectId}, ${canonical}, NULL, ${new Date().toISOString()}, 0)
                ON CONFLICT(path) DO UPDATE SET last_opened_at = excluded.last_opened_at, sort_order = 0
              `;
              return { ...(yield* list), openedProjectId };
            }),
          ),
        );

      const forget = (id: string) =>
        transaction(
          Effect.gen(function* () {
            const forgotten = yield* sql`DELETE FROM projects WHERE id = ${id} RETURNING id`;
            if (forgotten.length === 0) return yield* notListed;
            return yield* list;
          }),
        );

      /** Names only this entry. An empty name clears it, so the project follows its folder again. */
      const rename = (id: string, name: string) =>
        transaction(
          Effect.gen(function* () {
            const renamed = yield* sql`
              UPDATE projects SET name = ${name === "" ? null : name} WHERE id = ${id} RETURNING id
            `;
            if (renamed.length === 0) return yield* notListed;
            return yield* list;
          }),
        );

      return {
        snapshot: list.pipe(Effect.catchTag("SqlError", (error) => Effect.fail(unusable(error)))),
        open,
        forget,
        rename,
      };
    }),
  );
}
