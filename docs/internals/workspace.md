# Workspace

A bun workspace driven by [vite-plus](https://vite.plus) (`vp`).

## apps

- `apps/client` (`@eitri/client`): a shared Angular UI for the web and Tauri desktop clients. A mobile client is planned.
- `apps/server` (`@eitri/server`): TypeScript RPC server running on Bun, bundled with `vp pack`. Imports the shared Effect contracts directly. Tauri ships it as a compiled Bun sidecar; see [Architecture](architecture.md).

Reusable Spartan Helm components live in `apps/client/projects/ui` and are imported through the client’s `@ui/*` aliases. Storybook configuration lives in `apps/client/.storybook`, with stories alongside client components.

## packages

- `packages/contracts` (`@eitri/contracts`): shared Effect schemas and derived types. Anything both a client and the backend must agree on belongs here, including `EitriRpcs` in `@eitri/contracts/rpc`, the group of every call a client can make, and `RPC_PATH`, where the server accepts its WebSocket.
- `packages/shared` (`@eitri/shared`): framework-independent behavior derived from those contracts, currently validating agent and project input and reading their replies.

## Other top-level directories

- `scripts/`: release versioning and workspace cleanup tooling.
- `docs/`: this documentation tree.

## Import conventions

`@eitri/shared` and `@eitri/contracts` export `./agent`, `./project` and `./folder`, with no root export. Import the explicit subpath. Files that are not exported are implementation details.

Within the Angular app, `@core/*`, `@features/*`, `@pages/*` and `@shell/*` map to
the corresponding folders. Import the owning file directly, and use relative
imports within a component or its owning area. The mappings are maintained in
`apps/client/tsconfig.json` and `tsconfig.depcruise.json`.

See [Client UI](client-ui.md) for frontend placement and component folders, and
[Architecture](architecture.md) for server responsibilities and the request flow.
