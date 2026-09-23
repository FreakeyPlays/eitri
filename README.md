# Eitri

Eitri is an open-source desktop application for managing software development with coding agents. It gives you a graphical interface for working with installed agent CLIs, starting with **Codex** and **Claude Code**, using your existing accounts and subscriptions.

The goal is a software factory you can understand, extend, and make your own: a fast desktop app with clear controls for coordinating agents and their work. Eitri is built with Tauri, an Angular interface, and a local Bun server.

## Installation

Application bundles will be attached to this repository's **GitHub Releases**. The current release workflow targets a universal macOS `.dmg` for Apple Silicon and Intel Macs.

The application bundle includes Eitri's local server. Agent CLIs are installed separately: install and sign in to Codex or Claude Code before sending prompts.

### Local development

> [!IMPORTANT]
> **Prerequisites**
>
> - [Vite+](https://viteplus.dev/guide) (`vp`) to manage the JavaScript toolchain. The repository pins Node.js and Bun in [package.json](package.json); the server runs on Bun.
> - For desktop development, [Rust](https://rustup.rs/) and the [Tauri system prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform. On macOS, the Xcode Command Line Tools are sufficient for desktop builds.
> - To send prompts, an installed and signed-in Codex or Claude Code CLI, available on your `PATH`. You can build the interface and run the automated tests without either CLI.
>
> Clone this repository, open a terminal in its root directory, and install the dependencies:
>
> ```sh
> vp install
> ```

#### Run the desktop application

Prepare the bundled server executable once after a fresh checkout, then start the application:

```sh
vp run @eitri/client#sidecar
vp run dev:desktop
```

The first command creates the executable Tauri requires during compilation. The development command starts the desktop window, frontend, and server in watch mode. During development, the app uses the watched server. Run the sidecar preparation command again if you remove the generated sidecar files.

#### Run on localhost

After installing dependencies, start the server and frontend in two terminals from the repository root.

Terminal 1:

```sh
vp run dev:server
```

Terminal 2:

```sh
vp run dev:web
```

Open **http://localhost:1420**. The frontend forwards `/api` requests to the local server at `127.0.0.1:4318`. Keep both terminals running; stop them with `Ctrl+C` when finished. This workflow does not require Rust or a desktop build.

## Repository layout

| Directory            | Contents                                                  |
| -------------------- | --------------------------------------------------------- |
| `apps/client`        | Angular UI, reusable controls, Storybook, and Tauri shell |
| `apps/server`        | Bun + Effect server that runs agent CLIs                  |
| `packages/contracts` | Shared request and response schemas                       |
| `packages/shared`    | Portable helpers shared by the applications               |
| `scripts`            | Release versioning and workspace maintenance              |
| `docs`               | User documentation, architecture, and development notes   |

Start with the [architecture guide](docs/internals/architecture.md) for the server source map
and request flow, and [client UI guide](docs/internals/client-ui.md) for frontend ownership.

## License

Eitri is available under the [MIT License](LICENSE).
