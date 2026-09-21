# Client UI

The web and desktop UI lives in `apps/client/projects/desktop/src/app`.

```text
app/
├── app.component.ts        mounts the shell
├── app.config.ts           application providers
├── app.routes.ts           page registration
├── app.commands.ts         commands available across pages
├── core/
│   ├── agents/             agent server requests
│   ├── client/             web and Tauri runtime adapters
│   └── projects/           the open project and the ones to return to
├── pages/
│   ├── page.ts             page definition and route mapping
│   ├── new-chat/           chat page, sidebar and placeholder panels
│   ├── settings/           settings page and sidebar
│   └── features/           shared features across pages
└── shell/
    ├── shell.component.*   composes the window and resizable regions
    ├── animate-icon.directive.ts  shared by app bar and sidebar
    ├── app-bar/            window controls, project switcher and panel toggles
    ├── commands/           command contract and palette
    ├── layout/             panel state, persistence and sizing calculations
    ├── projects/           the contents of the app bar's project dropdown
    └── sidebar/            reusable sidebar item
```

The folders follow ownership: `pages/` owns each screen, `shell/` owns the window
around it, and `core/` owns runtime communication and platform adapters. Root
`app.*` files wire these pieces together. Keep templates and tests beside their
implementation. Page-specific UI stays with its page; shared visual primitives
live in `apps/client/projects/ui`. Keep code with its owner until actual reuse
justifies sharing it; there is no need for an additional `features/` layer today.

## Pages and panels

A `*.page.ts` declaration names the main and sidebar components, optional right
and bottom components, and page-specific commands. Register it in
`app.routes.ts` with `pageRoute(...)`.

The router renders the main component. The shell renders the other regions.
`LayoutService` follows the active page and remembers panel sizes and visibility.
Omitting a panel hides it and its toggles without forgetting the user's preference.
Sizing calculations remain separate from DOM measurement and dragging in the shell.

Collapsing a panel keeps its component mounted. Navigating to a page that omits
the panel destroys that component; returning creates it again. Saved layout
preferences survive, but component-local state does not.

## Commands

Application commands live in `app.commands.ts`; page commands live in that page's
declaration. The palette groups them and evaluates their optional `when` predicates.
It calls `when` and `run` in an injection context, so they can use `inject()`
synchronously. Resolve dependencies before awaiting asynchronous work.

## Runtime services

`AgentService` owns requests and response handling. `ClientService` selects the web
or Tauri adapter that resolves the server address at runtime. Pages use these
services rather than choosing a platform or embedding a server origin themselves.

`ProjectService` holds what the user works in — one project, or all of them — and
the projects they can return to. The backend owns that list; see
[User data](user-data.md). Only a saved answer reaches its signals, so a refused
switch leaves the selection alone. It exposes `canBrowse` for the one platform
difference: the desktop shell opens a folder picker, while the browser has none and
asks for a path instead. `AppComponent` calls `load()` once at startup to restore
the last selection.

Selecting all projects is a scope, not a screen: `allSelected()` is true and
`active()` is null, which later widens the sidebar from one project's chats to
every project's. Forgetting the selected project widens the scope the same way
rather than choosing a replacement.

Projects are chosen in exactly one place: the dropdown on the project name in the
app bar. `shell/projects/` holds its contents, and the app bar hosts it in a
`brn-popover`. No dialog, and no second entry point in the sidebar, the start page
or the command palette — the name in the app bar is both the label and the control,
so there is nothing to keep in sync.
