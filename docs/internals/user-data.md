# User data

What one user collected across every project lives in a data directory the
backend owns. It holds the projects they opened, and later whatever else spans
projects. The client never reads it directly. Clients connected to the same data share
the durable collection, and the list survives a restart. Each client holds a
snapshot; live updates between clients are not implemented.

```text
~/.eitri/userdata/
└── state.sqlite   durable application state, including projects
```

The home directory, not the filesystem root: `/.eitri` would need administrator
rights and would be shared by every account on the machine. A per-project
`<project>/.eitri/` is a separate idea for a later feature — settings that belong
to a project and could be committed with it. The list of projects cannot live
there, because it has to be readable before any project is open.

## Which directory a run uses

`runServer` requires an explicit data directory and supplies the database to the
project store. Only `bin.ts`, through `storage/data-dir.ts`, chooses a default:

| Start                                               | Directory                      |
| --------------------------------------------------- | ------------------------------ |
| Installed app and packaged sidecar                  | `~/.eitri/userdata`            |
| `vp run dev:server`, `vp run dev:desktop` (`--dev`) | `~/.eitri-dev/userdata`        |
| Any run with `EITRI_DATA_DIR` set                   | that directory                 |
| Tests                                               | a throwaway directory per test |

Development uses its own directory so experiments never touch the data of an
installed Eitri. It survives restarts like real data does, and migrations keep it
current. Tests pass a temporary directory in process, and set
`EITRI_DATA_DIR` for the executable — including the compiled sidecar.

## state.sqlite

The backend stores stable project IDs, canonical paths, last-opened timestamps,
chosen names, and display order in SQLite. The `name` column is nullable and only
holds a name the user chose: while it is null the project follows its folder.
Saving an empty name clears it back to null; any other name is stored as typed,
including one that happens to match the folder. Reopening a folder never disturbs
the name it already carries.
Which project a window shows is not stored anywhere: every client starts on all
projects.

`apps/server/src/storage/database.ts` opens the file through Effect SQL's Bun client, which serializes
access, waits up to five seconds for a busy database, uses WAL (so
`state.sqlite-wal` and `state.sqlite-shm` sit beside it) and runs every explicit
transaction as `BEGIN IMMEDIATE`. Concurrent servers therefore cannot silently
replace one another's project list. The connection closes with the server.

Schema changes are migrations: one file per change
in `apps/server/src/storage/migrations/`, named `<id>_<name>.ts`, whose default export is
the Effect that applies it. `database.ts` lists each one in a static record, so the
compiled sidecar carries them, and Effect's `Migrator` runs the ones a database has
not recorded in `effect_sql_migrations`, all in one transaction, before the server
answers anything. A development database is upgraded exactly like a user's.

To change the schema, add the next file (say `002_project_icons.ts`) and list it in
`database.ts`. Never edit a migration that shipped: databases that already ran it
would not see the edit. The first migration uses `IF NOT EXISTS`, so databases from
before migrations were tracked are adopted as they are.

There is no legacy `projects.json` import. The JSON formats existed only during
development on this branch, not in a released version with project storage.
Opening a fresh database starts an empty collection. Project relocation is not
implemented; renaming changes only the displayed name, not the stored path.

Rules the store keeps:

- **A project counts as open only after its transaction commits.**
- **Newer data is never touched.** A database that recorded a migration this
  Eitri does not know fails with the file named in the error.
- **A missing folder is not a deletion.** Remembered records remain until the
  user forgets them, and forgetting never touches the folder on disk.
- **Canonical paths are unique.** A symlink or a `..` detour cannot create a
  second identity for one project.
- **History is not capped.** Stable project identities are removed only when the
  user explicitly forgets them.
