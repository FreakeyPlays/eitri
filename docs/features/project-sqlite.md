---
status: ready
tracking: null
related: docs/features/project-identity.md, docs/internals/user-data.md
---

# Step 5: SQLite project storage

## Why

Store stable project records transactionally and establish the small database foundation for later relationships. Chats, runs and event history remain outside this branch.

## Behavior and implementation plan

1. Replace the project JSON persistence implementation with Bun's built-in SQLite in `<dataDir>/state.sqlite`. Keep the project interface and HTTP behavior from step 4 intact. Avoid an ORM or new database abstraction hierarchy.
2. Use a versioned schema with project ID primary key, unique canonical path and last-opened timestamp. Preserve the step-4 ordering and derived display name. Use explicit transactions for mutations and migration, bounded busy handling, and deterministic database cleanup with server lifetime. Do not silently evict stable project identities merely to cap display history.
3. On first database initialization, import both the original version-1 JSON list and any step-4 intermediate version. Preserve IDs where present, assign IDs otherwise, and retain timestamps and missing-folder entries without probing or rejecting each imported path. Do not carry server-global selection forward.
4. Validate before committing. Schema creation, imports and migration marker must succeed atomically. Leave the original JSON untouched as migration evidence/backup. Record completed initialization in the database so later starts and forgetting every project cannot reimport stale JSON. Report malformed/unknown legacy formats or newer database schemas clearly without overwriting them.
5. Keep `~/.eitri/userdata`, `~/.eitri-dev/userdata`, `EITRI_DATA_DIR`, and explicit test directories unchanged. Never open the live developer data read-write. Introduce only directories/files needed for this storage.
6. Update persistence documentation and server lifecycle integration, plus tests using temporary directories. Check Bun bundling/sidecar compatibility through the existing build/check setup.

Migration inputs: original version 1 is `{ version: 1, lastProjectPath, projects: [{ path, lastOpenedAt }] }`; intermediate version 2 is `{ version: 2, projects: [{ id, path, lastOpenedAt }] }`. Version 2 IDs must survive unchanged. The HTTP contracts from step 4 must not change during the storage replacement.

## Scope

Include project persistence, one-time safe JSON import, schema versioning and connection cleanup. Exclude chats/runs/events, full event sourcing, new folder layouts and changes to the transport or project API.

## Completion criteria

- New and migrated projects preserve IDs, canonical-path uniqueness, timestamps and ordering after close/reopen.
- Legacy JSON is unchanged after successful import and after a failed import.
- Repeated startup does not duplicate/reimport projects, including after all projects were forgotten.
- A failed migration cannot leave a partially populated initialized database.
- Future schema versions and malformed legacy files produce actionable failures.
- Concurrent operations do not lose project records; connections close during server shutdown.
- Relevant persistence/server tests, type checks and server build pass without touching live userdata.

## Validation

An independent GPT-5.6-Sol reviewer checks data-loss/migration cases and lifecycle behavior, and executes automated checks. Manual UI testing is deferred.

## Implementation status — 2026-09-22

Implemented SQLite-backed project storage, transactional schema initialization and legacy JSON import, stable ID preservation, migration markers and deterministic connection cleanup. Independent review completed with no findings.

Integrated validation passed: the root unit suite ran 32 files and 268 tests with zero failures; all six typecheck tasks, formatting for 257 files, Knip and dependency-cruiser passed. `vp check` reported three existing warnings in untouched shared UI files. Earlier focused server and compiled-sidecar tests and the server build also passed without using live userdata.

Manual testing remains: start against disposable copies of representative version-1 and version-2 data, confirm projects and IDs survive restart, forget every project and restart without reimport, and confirm migration failures leave the legacy JSON unchanged.
