# Architecture

Eitri has an Angular frontend and a TypeScript backend running on Bun.
The standalone server uses shared Effect contracts and is bundled with `vp pack`.
Bun compiles the bundle into a standalone executable. Tauri ships that executable,
and starts one server per desktop process. The frontend talks to it over one
WebSocket, using Effect RPC.

## Transport

Every call a client makes is an Effect RPC defined once in `EitriRpcs`
(`@eitri/contracts/rpc`): its payload, answer and expected error as Effect Schemas.
The server implements the group in `apps/server/src/transport/rpc.ts`; the client derives its
typed calls from the same group in `ServerService`. Payloads are decoded on the
server before a handler runs, and answers are decoded on the client, so neither
side trusts the wire. Expected failures are tagged errors (`ProjectsError`,
`FoldersError`, `AgentError`) carrying one sentence for the user.

Calls travel over a single WebSocket at `RPC_PATH` (`/api/rpc`), served by
`BunHttpServer` and `HttpRouter`. The socket stays open between calls. Streaming agent output and live project
change notifications are not implemented; sharing database state does not
automatically refresh another client's already-loaded list. A WebSocket ignores the same-origin policy, so the server refuses
an upgrade from any origin other than the Tauri shell, the dev server or itself.
Plain HTTP is left for `/health`; project operations and folder browsing use RPC.

## Current structure

- **Frontend** (`apps/client`): Angular UI shared by the web
  and desktop clients. Folder ownership, pages, commands and panels are described
  in [Client UI](client-ui.md).
  `ServerService` holds the RPC connection; client adapters resolve the server
  address and isolate native capabilities. The Tauri shell in `apps/client/src-tauri`
  owns the packaged server's lifecycle.
- **Server** (`apps/server`): validates requests, selects the installed Agent CLI,
  passes the prompt through stdin, and returns its completed output. Owns process
  execution, timeouts, and cleanup. Each request starts a fresh conversation.
  It also owns the user's data directory: projects have stable IDs and live in
  `state.sqlite` there, so clients share the remembered collection. Which project
  a window shows stays in that window.
  See [User data](user-data.md).
- **Contracts** (`packages/contracts`): shared schemas, derived types, and the RPC
  group defining what crosses the client/server boundary. Keep execution and
  application state in the applications.
- **Shared** (`packages/shared`): portable runtime helpers derived from the
  contracts, currently request validation and response decoding. Keep these
  independent of browser, native, and server APIs.
- **UI** (`apps/client/projects/ui`): reusable Spartan Helm controls owned by the client,
  with Storybook examples alongside components and configuration in `apps/client/.storybook`.
  Owns presentation and control interaction; feature state and agent calls belong
  in the client application.

## Server source map

```text
apps/server/src/
├── bin.ts                  executable: environment, arguments, exit handling
├── server.ts               composition: database, project store, HTTP and lifetime
├── transport/
│   ├── http.ts             health route, WebSocket transport and origin guard
│   └── rpc.ts              maps the shared RPC group to application operations
├── agents/agent.ts         installed CLI execution, timeouts and cleanup
├── projects/project-store.ts  project operations and transactional SQL
├── filesystem/folders.ts   readable paths and directory listings
├── storage/
│   ├── data-dir.ts         selects installed, development or explicit data directory
│   ├── database.ts         opens SQLite and applies migrations
│   └── migrations/         ordered, statically imported schema changes
└── test-utils/server.ts    real-server and RPC-client fixtures for tests
```

Start at `bin.ts`, then `server.ts` to see how a run is assembled. Follow a request
from `transport/rpc.ts` into its owning module. Transport translates calls;
projects, agents and filesystem implement the behavior without importing transport.
Storage owns database lifetime and schema; project SQL stays with project operations
so their transaction rules can be understood in one place. Tests sit beside the
code they exercise; root server and executable tests cover the assembled system.

Keep new behavior with the responsibility that owns it, adding a subfolder when
there is a distinct group to navigate. `storage/` owns opening and migrating the
database; it is not a second home for every feature's queries. Shared test
fixtures belong in `test-utils/`, outside production dependencies. Folder names
express these responsibilities; they do not require extra wrapper layers.

For project state, start with `features/projects/` in the client; for its menu,
start with `shell/app-bar/project-switcher/`. Follow the request through
`packages/contracts/src/project.ts` and `rpc.ts` for the wire contract, and
`projects/project-store.ts` in the server. Add a migration only when stored data
changes. For a new RPC, declare it in contracts, implement the behavior with its
owner, then connect it in `transport/rpc.ts`. Add runtime dependencies in
`server.ts`. Avoid introducing parallel controller, service and repository layers
when one module already expresses the operation clearly.

## Runtime

```mermaid
flowchart TB
    UI[Angular frontend] -->|Effect RPC over WebSocket /api/rpc| H[Bun server]
    H --> S[TypeScript agent adapter]
    H --> P[Project list in the data directory]
    S --> C[Installed Agent CLI]
    UI -->|First request: get_server_url| T[Tauri shell]
    T -->|Start and stop sidecar| H
    UI -->|Available client features| N[Native adapters]
```

The Angular dev proxy forwards `/api/**`, WebSockets included, to `127.0.0.1:4318`. Run `vp run dev:server`
alongside `vp run dev:web`, or `vp run dev:desktop`, which starts both beside the shell.
In development the shell starts no sidecar; the frontend reaches the watched server
through the proxy.

`vp pack` bundles JavaScript dependencies into `dist/bin.mjs`; Bun Compile embeds
it with the runtime. The `sidecar` task builds only the requested target and stages
`sidecar/eitri-server-<Rust target>` for `externalBin`. Tauri checks for that file
in every build, development included. macOS universal builds keep the ARM64 and x64
binaries under their own triples, because Tauri builds each architecture separately,
and join them with `lipo`. Neither a separate Bun runtime nor a JavaScript resource
is shipped.

Choosing a project and returning to an earlier one works; chats inside a project,
the rest of the project workflow, and remote access are not implemented yet.

Keep presentation in the UI and process integration inside the server adapter.
See the [workspace guide](workspace.md) for import conventions.
