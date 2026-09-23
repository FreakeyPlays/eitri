---
status: ready
tracking: null
related: docs/features/project-identity.md, docs/internals/client-ui.md
---

# Step 6: Browse project folders on the server

## Why

The web client currently requires a manually entered absolute path. Browser directory handles do not supply the native path needed by the backend. Provide a small folder browser backed by the server filesystem.

## Behavior and implementation plan

1. Add a schema-backed read-only HTTP endpoint under `/api` for listing one server directory. Use the existing origin checks and runtime endpoint resolution. An omitted path starts at the server home directory; accept explicit absolute paths and `~` paths. Return current canonical path, parent path (null at root), and sorted immediate child directories with full paths. No recursive crawling, file contents, uploads, or filesystem mutations.
2. Encapsulate filesystem enumeration in a small server module. Follow directory symlinks safely for navigation, ignore broken/unreadable individual children where appropriate, and report unusable requested directories clearly. Bound the returned entry count and tell the UI if truncated rather than silently implying a complete listing. Preserve cross-platform path handling.
3. Add a client adapter/service and a folder-browser Angular component with separate TypeScript, HTML and spec files. Use existing UI controls and Tailwind. Include editable path with explicit navigation, parent navigation, a directory list, current-folder selection, cancel, loading, empty and error states. Do not fetch recursively or continuously animate while idle.
4. Web's Open folder action opens this browser. Selecting a folder uses the existing project-open flow from step 4; only confirmed success closes the project selection UI. Cancel never changes selection. Desktop retains its native picker and can offer the same server-folder browser as an alternative if it fits the existing menu simply.
5. Prevent stale browse responses from replacing newer navigation; disable choosing a stale/loading directory. Keep manual path entry available inside the browser. Clearly indicate that paths refer to the server, without technical implementation text in normal product flow.
6. Update client documentation and add filesystem, HTTP and component tests. Coordinate with step 5: own the browse module/contracts/route/UI, leave project persistence and server lifecycle to that implementation.

Pinned endpoint: `GET /api/folders?path=...`, encoded with `URLSearchParams`. Sort eligible child directories before applying the result cap. Keep each child's displayed entry name but return its canonical path, including for symlinks. Request-generation guards must cover listing, loading and error updates so a stale failure cannot overwrite a newer success.

## Scope

No browser FilePicker API, Electron/Tauri rewrite, RPC migration, folder creation, project copying, repository scanning, or remote-server onboarding. The existing endpoint/origin model remains.

## Completion criteria

- Web can navigate from home, enter a path, go up, and open the current folder as a project.
- Root, spaces/Unicode, symlinks, empty/inaccessible/missing folders and truncated listings behave predictably.
- Out-of-order responses cannot select or display the wrong directory.
- Cancel and failed opens preserve the previous project; native desktop picking still works.
- Backend/shared/client unit tests, type checks and client build pass without launching a browser.

## Validation

An independent GPT-5.6-Sol reviewer checks endpoint and state-management behavior and runs automated checks. Later manual checks should exercise web navigation, native desktop picking, error recovery and selection independence.

## Implementation status — 2026-09-22

Implemented the bounded server directory listing endpoint, folder client adapter and Angular browser flow, including stale-response guards, explicit truncation, server-path messaging and project-open integration. Independent review was completed; enumeration is bounded to 32 workers and Cancel is disabled while a project open is pending.

Integrated validation passed: the root unit suite ran 32 files and 268 tests with zero failures; all six typecheck tasks, formatting for 257 files, Knip and dependency-cruiser passed. `vp check` reported three existing warnings in untouched shared UI files. Earlier focused client/server tests and builds also passed; the client build retained its existing 715 kB versus 500 kB bundle-budget warning.

## Revision — 2026-09-22

The explicit **Go** button is gone. The path field is split at its last separator: the
folder ahead of it is browsed, and the text after it filters that folder's listing in
the client. Typing therefore reaches the server only when the user crosses a separator,
so a partial name like `~/g` narrows the list to `git` instead of failing as a missing
path. Enter opens the first remaining match, the listing scrolls within a bounded
height, and clicking a folder or **Up** rewrites the field to that folder with a
trailing separator, ready for the next filter.

Manual testing remains: exercise home, parent, typed-path and directory navigation in web; cover spaces/Unicode, symlinks, empty, inaccessible, missing and truncated directories; verify error recovery and stale navigation; confirm failed opens and Cancel preserve selection; and verify native desktop picking.

## Revision — 2026-09-22 (structure)

`FolderBrowserService` is gone. Listing a server folder is `ProjectService.listFolders()`,
beside the native `pickFolder()`, since both exist only to find a project folder.
The browser component owns its navigation state and the newest-navigation guard.

## Revision — 2026-09-23

Folders are listed by the `folders.browse` RPC instead of `GET /api/folders`. The
listing no longer carries `parentPath`: no client navigated upwards with it.
