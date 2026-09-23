# Client UI

The web and desktop UI lives in `apps/client/projects/desktop/src/app`.

The frontend is organized around pages and their UI owners, with shared
application state kept separately. It is one Angular application, not a library
per feature. The server has its own responsibility-based structure; see
[Architecture](architecture.md#server-source-map).

```text
app/
├── app.*                   startup, providers, routes and application commands
├── core/                   technical infrastructure, independent of features and UI
│   ├── platform/           web and Tauri capabilities, runtime server address
│   └── connection/         shared RPC connection and transport errors
├── features/
│   ├── agents/             sending prompts through the server
│   └── projects/           project collection and current selection
├── pages/
│   ├── page.ts             page declaration and route helpers
│   ├── new-chat/           page declaration and main component
│   │   ├── chat-sidebar/
│   │   └── empty-panel/
│   └── settings/           page declaration and main component
│       └── settings-sidebar/
└── shell/
    ├── shell.component.*   window and resizable regions
    ├── animate-icon.directive.ts
    ├── app-bar/            window controls and panel toggles
    │   └── project-switcher/
    │       ├── project-switcher.component.*
    │       ├── project-menu/
    │       ├── folder-browser/
    │       └── project-settings/
    ├── commands/           command contract
    │   └── command-palette/
    ├── layout/             panel state, persistence and sizing calculations
    └── sidebar/
        └── sidebar-item/
```

Organize UI by the screen or shell element that owns it. `pages/` owns routed
screens and their panels; `shell/` owns the surrounding window. The project
switcher and its dialogs live inside the app bar because that is their only home.
Page-specific UI and behavior stay with their page.

`features/` holds application capabilities and state used independently of a
particular screen. For example, `ProjectService` serves startup, the new-chat
page and the project switcher. It owns the collection and selection, while the
switcher owns how the user operates the menu. `core/platform/` isolates web and
Tauri capabilities; `core/connection/` owns RPC transport. `core/` must not depend
on application features, pages or shell UI. Being used throughout the application
does not make state infrastructure: the project collection still belongs in
`features/projects/`. Root `app.*` files assemble these pieces. Shared visual
primitives live in `apps/client/projects/ui`.

Each application component has its own folder, containing its implementation,
template and test; very small templates may remain inline. A page or shell
component can use its existing owning folder;
additional components get named subfolders, such as `new-chat/chat-sidebar/` and
`project-switcher/project-menu/`. The root `AppComponent` remains beside `app.*`.

Use `@features/`, `@core/`, `@pages/` and `@shell/` for imports across these
folders and relative imports within an owning folder. Import the owning file
directly. A page can use shared state without another page importing its internals;
shared state and transport should not depend on pages or shell UI.

For example, a composer used only on the chat page belongs to that page. A search
field used only in the project menu belongs to the switcher. Move state or controls
to a shared home when another owner needs them; do not pre-create folders for
future workflows or documents. These placement rules are conventions; existing
dependency checks do not enforce every frontend ownership rule.

## Pages and panels

A `*.page.ts` file exports an Eitri-specific configuration object, not an Angular
component. Its `Page` type lives in `pages/page.ts` and names the route path, main
and sidebar components, optional right and bottom components, and page-specific
commands. The actual Angular component remains in `*.component.ts` with its
template and test.

For example, `new-chat/new-chat.page.ts` connects `NewChatComponent` to
`ChatSidebarComponent` and the empty panels. `settings/settings.page.ts` supplies
the settings view and sidebar without right or bottom panels.

Register the declaration in `app.routes.ts` with `pageRoute(...)`. That helper
uses `main` as the route component and stores the declaration in route data;
`activePage()` reads it for the shell. This small configuration keeps each page's
panel choices together. It is our layout convention, not an Angular requirement
or a separate router. We have not replaced it with nested layout routes or named
router outlets.

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

`ServerService` is the one connection to the server: an Effect RPC client over a
WebSocket, typed by `EitriRpcs` from `@eitri/contracts/rpc`. `call(tag, payload)`
resolves with the answer or rejects with a sentence the user can act on — the
server's own for a refusal, a plain one for a lost connection or a server fault.
The socket opens with the first call and reconnects on its own after the server
restarts; while it is gone, calls fail at once instead of hanging. Only this
service knows the transport, so domain services such as `AgentService` and
`ProjectService` stay unchanged if it ever moves. `ClientService` selects the web
or Tauri adapter that resolves the server address at runtime. Pages use these
services rather than choosing a platform or embedding a server origin themselves.

`ProjectService` holds what the user works in — one project, or all of them — and
the projects they can return to. The backend owns that list; see
[User data](user-data.md). A project becomes active only after the backend confirms
it opened; choosing all projects is local. The selection lives only in memory and
never alters the server's shared project list. `AppComponent` calls `load()` once
at startup to read the list.

Finding a folder to open belongs to the same service, because it has no other
purpose. `canPickFolder` names the one platform difference: desktop calls
`pickFolder()` for the native picker, while web browses the server's folders with
`listFolders(path?)`, a stateless `folders.browse` call that never touches
project state.

`FolderBrowserComponent` owns its navigation: home, typed paths and the listing on
screen. Its one field is split at the last separator: the part ahead of it is the
folder to list, the part after it filters that listing in the client. So typing
only reaches the server when the user crosses a separator, and a partial name
narrows the list instead of failing as a missing path. Only the newest navigation
may write what is shown, so a late response cannot replace it. The last listing
stays visible while the next loads. Browsing is read-only; opening the selected
path still goes through `ProjectService.open()` and closes the dropdown only after
the backend confirms the project.

Selecting all projects is a scope, not a screen: `allSelected()` is true and
`active()` is null, which later widens the sidebar from one project's chats to
every project's. Forgetting the selected project widens the scope the same way
rather than choosing a replacement.

Projects are chosen in one menu: the dropdown on the project name in the app bar.
`ProjectSwitcherComponent` is that name and its `brn-popover`; the app bar only
places it. The palette's "Projects" command opens the same dropdown by setting
`LayoutService.projectMenu`, which the popover's state follows, so there is still
only one list to keep in sync.

Which project a window shows is not persisted. Every start reads the collection
and begins on all projects; the server remembers the projects, not the selection.

Each row carries an always-visible settings button, because an action that only
appears on hover cannot be found by anyone who is not already looking for it. It
opens `ProjectSettingsComponent` in a dialog: the two things that are about one
project rather than about choosing one — the name Eitri shows for it, and removing
it from Eitri. Removal is styled as destructive and asks once, and it only ever
drops the record: the folder and its files are never touched. Neither outcome
emits `chosen`, so opening settings never counts as picking a project.
