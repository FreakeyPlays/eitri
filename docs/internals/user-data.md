# User data

What one user collected across every project lives in a data directory the
backend owns. It holds the projects they opened, and later whatever else spans
projects. The client never reads it directly, so the web and desktop clients of
one Eitri always agree, and the list survives a restart.

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

`runServer` and the project store require the directory; they have no default of
their own. Only `bin.ts` decides, so no library call can quietly reach real data:

| Start                                               | Directory                      |
| --------------------------------------------------- | ------------------------------ |
| Installed app and packaged sidecar                  | `~/.eitri/userdata`            |
| `vp run dev:server`, `vp run dev:desktop` (`--dev`) | `~/.eitri-dev/userdata`        |
| Any run with `EITRI_DATA_DIR` set                   | that directory                 |
| Tests                                               | a throwaway directory per test |

Development uses its own directory so experiments never touch the data of an
installed Eitri. Tests pass a temporary directory in process, and set
`EITRI_DATA_DIR` for the executable — including the compiled sidecar.

## state.sqlite

The backend stores stable project IDs, canonical paths, last-opened timestamps,
chosen names, and display order in SQLite. The `name` column is nullable and only
holds a name the user chose: while it is null the project follows its folder.
Saving an empty name clears it back to null; any other name is stored as typed,
including one that happens to match the folder. Reopening a folder never disturbs
the name it already carries.
Selection belongs to each client and is not stored as server-global state. The
client keeps its `selectedId` in local storage under
`eitri.project-selection:desktop-local` for desktop or a key scoped to the web
origin.

The database uses SQLite's `user_version` as its schema marker. Project
mutations and first-run schema creation use immediate transactions, so concurrent
backend connections cannot silently replace one another's project list.
Connections have bounded busy handling and close with the server that owns them.

Rules the store keeps:

- **A project counts as open only after its transaction commits.**
- **Unknown storage is never overwritten.** Unexpected unversioned tables, a mismatched current schema, and newer database versions
  fail with the file named in the error.
- **A missing folder is not a deletion.** Remembered records remain until the
  user forgets them, and forgetting never touches the folder on disk.
- **Canonical paths are unique.** A symlink or a `..` detour cannot create a
  second identity for one project.
- **History is not capped.** Stable project identities are removed only when the
  user explicitly forgets them.
