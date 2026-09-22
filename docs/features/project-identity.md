---
status: ready
tracking: null
related: docs/internals/user-data.md, docs/features/project-sqlite.md
---

# Step 4: Stable project identity and client-owned selection

## Why

The canonical path currently identifies a project and the server persists one global selection. Introduce stable IDs before future chats reference projects, and prevent one client from changing another client's current scope.

## Behavior and implementation plan

1. Add a server-generated stable UUID to each project. Keep canonical real paths unique and derive display names from the folder name. Opening an existing canonical path returns its existing ID; reopening, refresh and restart preserve it.
2. Separate the server's remembered project collection from selection. The HTTP collection snapshot contains projects, not a globally active project or selection notice. Opening/registering a path returns enough information to identify the successfully opened project. Forget by ID. Provide a validated path-update operation by ID so relocation preserves identity and rejects duplicate paths; a dedicated relocation UI is not required here.
3. Keep selection in the client as project ID or all projects. Persist it locally, scoped to backend identity (avoid ephemeral desktop ports invalidating selection), without cross-client selection synchronization. Storage failure must not prevent project use. Loading a missing/forgotten selection falls back clearly to all projects. Validate a remembered selected folder when restoring it; failure does not delete the project record.
4. Migrate legacy JSON project entries to IDs without deleting the original history on parse/version failures. Legacy global selection does not become ongoing server state. This intermediate storage is replaced in step 5; coordinate the migration format with that step.
5. Adapt contracts, shared helpers, HTTP handlers, project state and all affected UI consumers/tests. Track and compare project IDs in UI. All-project selection is local and sends no mutation to the backend. Failed project opens preserve the previous selection.
6. Update existing internal documentation/glossary to reflect ID identity and client-owned selection. Do not add a new parallel glossary or implement future agent features.

Implementation contract: `Project = { id, path, name, lastOpenedAt }`. `GET`, `DELETE` and `PATCH /api/projects` return `{ projects }`; `POST { path }` returns `{ projects, openedProjectId }`. `DELETE` takes `{ id }`; `PATCH` takes `{ id, path }`. The intermediate JSON format is `{ version: 2, projects: [{ id, path, lastOpenedAt }] }`. A web selection is scoped to its origin; the current local desktop backend uses a stable desktop key rather than its ephemeral port. No cross-tab storage-event synchronization is introduced.

Restoring a selected project intentionally counts as opening it: the client POSTs its current path, validates availability and updates last-opened ordering. A failed restore keeps the project record and falls back to all projects with a notice.

## Scope

Include stable IDs, id-based forget/relocation, local selection, preservation of existing projects, and meaningful regression tests. Keep current HTTP transport, data-directory rules, and native picker. Do not implement RPC, agent lifecycle, SQLite (step 5), or the folder browser (step 6).

## Completion criteria

- Opening a path and its symlink produces one stable ID, retained after restart.
- Relocation preserves ID; another project's path cannot be claimed.
- Two client instances select independently; all-project selection performs no server write.
- Failed opens, missing remembered directories, removed IDs and unavailable local storage have defined behavior.
- Legacy project records survive migration; malformed files are not overwritten.
- Contracts/shared/server/client unit tests and relevant type checks pass without browser automation.

## Validation

An independent GPT-5.6-Sol reviewer checks implementation against this plan, focuses on identity/selection regressions and executes relevant automated checks. Interactive testing is reserved for the user and primary agent later.

## Implementation status — 2026-09-22

Implemented stable UUID project identity, ID-based project operations, backend-scoped client selection, legacy migration compatibility and the related contract, server and client updates. Independent review was completed; its finding that an unknown `openedProjectId` must be rejected was fixed.

Integrated validation passed: the root unit suite ran 32 files and 268 tests with zero failures; all six typecheck tasks, formatting for 257 files, Knip and dependency-cruiser passed. `vp check` reported three existing warnings in untouched shared UI files. Earlier focused server/client builds also passed; the client build retained its existing 715 kB versus 500 kB bundle-budget warning.

Manual testing remains: verify two client instances keep independent selections, selection survives a desktop restart with an ephemeral port, missing/forgotten selections fall back clearly, failed opens preserve selection, and native desktop picking still works.
