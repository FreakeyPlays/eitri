# Eitri

Eitri is an open-source desktop application for managing software development with coding agents. It provides a graphical interface for working with installed agent CLIs, currently Codex and Claude Code, using the user’s existing subscriptions.

The desktop client is built with Tauri and manages the agent CLIs and coordinates their work. Desktop and Web are the only supported clients today, but mobile clients are planned.

I like ambitious ideas, simple systems, and software that feels obvious. Do not preserve complexity just because it already exists. Do not introduce machinery because it looks architecturally impressive. Understand the real constraint, then fight for the smallest model that makes the correct behavior unsurprising.

Channel both "measure twice, cut once" and "yagni". Fight scope creep. Try to honor the dev's intent in both a minimal and realistic fashion.

## What makes Eitri special?

### 1. Open at the core

Eitri is entirely open, and can be used or modified by anyone that wants a personalized Software Factory.

### 2. Pluggable

The Eitri application is planned to be a pluggable application so all users can extend it with their own features, tools or agents, even without copying the source code.

### 3. Performance without compromise

Lots of apps have gotten bogged down with bad tech decisions and "slop". We have not, and we're proud of the performance of Eitri. Make sure all changes are considerate of performance impact.

### 4. Multi-surface (planned)

Eitri has an **desktop** and **web** UI for now. In the future it will also provide a **mobile** version that.

**Desktop** is the main app most users will install and use on a daily basis. It's a Tauri app that bundles all necessary features (except Agent CLIs) to the end user.

## A small glossary

We need to be on the same page with terminology. When communicating, use this language:

- **you** means the agent reading this file and changing Eitri.
- **i, me, and myself** means the owner that is building Eitri. These are who you are talking to now.
- **user** means the person using Eitri.
- **client** means the web, desktop, or mobile UI.

A more detailed glossary can be found in [docs/internals/glossary.md](docs/internals/glossary.md).

## The three ways to hurt yourself

1. **Killing by pattern.** Never `pkill -f`, `pgrep | kill`, or `kill` a PID you found by matching a name, path, or worktree string. Your own agent process has this worktree's path in its argv, and this machine runs several other dev servers at once. Kill only a PID you captured at spawn, or the owner of your port from `lsof -nP -iTCP:<port> -sTCP:LISTEN` after confirming its cwd (`lsof -a -p <pid> -d cwd`) is your worktree.
2. **Writing to the live install.** `~/.eitri/userdata` is the developer's real Eitri database, in use while you work. Reading it and copying from it are fine, and a good way to get real test data. Never start a server against it, never open it read-write, never clean it up.
3. **Baking in origins.** The client finds its server at runtime: same-origin `/api` in the browser (the Angular dev server proxies it to `127.0.0.1:4318`), and `get_server_url` inside Tauri. Keep server origins out of the bundle; a hardcoded one breaks every other setup.

## Where code lives

- `apps/client`: Application shell. `apps/client/projects/desktop` contains the Angular web and desktop UI, and `apps/client/src-tauri` contains the Tauri configuration and Rust shell. `apps/client/projects/ui` holds a shared UI library with Spartan components.
- `apps/server`: Bun + Effect HTTP server that runs the Agent CLIs; Tauri ships it as a compiled sidecar.
- `packages/contracts`: Effect/Schema contracts plus small derived helpers. No heavy runtime logic.
- `packages/shared`: shared runtime utils, subpath exports, no barrel.
- `scripts`: release versioning and workspace cleanup.

Additionally we use CodeGraph, reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

## Taste

- Complexity belongs at the adapter boundary. Orchestration stays pure, UI stays dumb.
- Inferred types over annotations. `any` is the enemy.
- Comments describe how a thing is used, and move when the code moves. To be used mostly to describe functions, not to annotate every line of behavior.
- Our users drive agents all day and notice a dropped frame, a lying spinner, and a stale label. No continuously repainting animations; they peg the GPU on high-refresh displays.
- If a rule here fights the task in front of you, say so loudly and get a human sign-off before breaking it.

## Additional tips

- **IMPORTANT** Don't verify with browsers or computer use if I did not request it. If you think to use it ask me first.
- Security is important, but should not be over-indexed on, especially for dev mode/maintainer-only features.
- Always prefix commands with `rtk`. Even in command chains with `&&`, use `rtk`. (Wrong: ls && cd Correct: rtk ls rtk cd)
- An Angular Component consists of a ts, html and spec file. If you need you can also make a css file but only if it makes sense to not put it in gloabl css file. Fall back to inlien styles/html code if it is smaller than 5loc. and use tailwind consistently.
