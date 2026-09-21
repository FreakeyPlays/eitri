# User data

What one user collected across every project lives in a data directory the
backend owns. It holds the projects they opened, and later whatever else spans
projects. The client never reads it directly, so the web and desktop clients of
one Eitri always agree, and the list survives a restart.

```text
~/.eitri/userdata/
└── projects.json   projects the user opened, most recent first
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

## projects.json

```json
{
  "version": 1,
  "lastProjectPath": "/home/you/git/eitri",
  "projects": [{ "path": "/home/you/git/eitri", "lastOpenedAt": "2026-09-21T10:00:00.000Z" }]
}
```

Paths are canonical, so a symlink or a `..` detour cannot list one project twice.
Display names are derived from the path when read, which is why a renamed folder
shows its new name without a migration. The list is capped, and the most recently
opened project comes first.

`lastProjectPath` is null when the user selected **all projects** rather than one
of them. That is a selection like any other and survives a restart; it is also
where forgetting the selected project lands, because nothing should be picked on
the user's behalf.

Rules the store keeps:

- **A write replaces the file in one step.** It writes a sibling and renames it,
  so an interrupted run never leaves half a list behind.
- **A project counts as open only once it is saved.** The next start then shows
  the same thing the last one did.
- **A list we cannot read is never overwritten.** Unreadable or unknown-version
  storage is reported to the user, who decides what happens to the file.
- **A missing folder is not a deletion.** `lastProjectPath` stays; the client is
  told nothing is open and why, and the entry remains in the list. Moving the
  folder back is enough to restore it. Only the user forgets an entry, and that
  never touches the folder on disk.
- **Reads and writes take turns** within the process. Two backends sharing one
  directory are not coordinated; the desktop app runs a single backend, and
  development uses a directory of its own.
