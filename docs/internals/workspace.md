# Workspace

A bun workspace driven by [vite-plus](https://vite.plus) (`vp`).

## apps

- `apps/client` (`@eitri/client`): a shared Angular UI for the web and Tauri desktop clients. A mobile client is planned.
- `apps/server` (`@eitri/server`): TypeScript HTTP server running on Bun, bundled with `vp pack`. Imports the shared Effect contracts directly. Tauri ships it as a compiled Bun sidecar; see [Architecture](architecture.md).

Reusable Spartan Helm components live in `apps/client/projects/ui` and are imported through the client’s `@ui/*` aliases. Storybook configuration lives in `apps/client/.storybook`, with stories alongside client components.

## packages

- `packages/contracts` (`@eitri/contracts`): shared Effect schemas and derived types. Anything both a client and the backend must agree on belongs here, including the wire constants (`AGENT_ENDPOINT`, `PROJECTS_ENDPOINT`) that name where a request goes.
- `packages/shared` (`@eitri/shared`): framework-independent behavior derived from those contracts, currently validating agent and project input and reading their replies.

## Other top-level directories

- `scripts/`: release versioning and workspace cleanup tooling.
- `docs/`: this documentation tree.

## Import conventions

`@eitri/shared` and `@eitri/contracts` currently export `./agent` and `./project`, with no root export. Import the explicit subpath. Files that are not exported are implementation details.

See [Architecture](architecture.md) for runtime boundaries and planned responsibilities.
