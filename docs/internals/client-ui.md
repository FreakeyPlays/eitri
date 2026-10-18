# Client UI

The web and desktop UI lives in `apps/client/projects/desktop/src/app`.

```text
app/
├── app.*                   startup, providers and routes
├── core/                   technical infrastructure, independent of features and UI
│   ├── platform/           web and Tauri capabilities, runtime server address
│   └── connection/         shared RPC connection and transport errors
├── features/
│   ├── agents/             sending prompts through the server
│   └── projects/           project collection and current selection
│       └── project-scope/  parent route of the project pages, no-project screen
├── pages/
│   ├── workspace.ts        project pages: routes and sidebar entries
│   ├── overview/, manage/, wiki/
│   ├── new-session/
│   └── settings/           settings.ts: settings pages, routes and sidebar entries
└── shell/
    ├── shell.component.*   window, sidebar slot and resizable panels
    ├── app-bar/            window controls, breadcrumbs and panel toggles
    │   ├── breadcrumbs/
    │   └── project-switcher/
    │       ├── project-switcher.component.*
    │       ├── project-menu/
    │       ├── folder-browser/
    │       └── project-settings/
    ├── empty-panel/        placeholder for panels without content yet
    ├── layout/             panel visibility and sizes
    ├── route-trail.ts      the route trail as a signal, for shell parts that follow the page
    └── sidebar/            the sidebar and its items
```

Organize UI by the screen or shell element that owns it. `pages/` owns routed
screens; `shell/` owns the surrounding window. The project
switcher and its dialogs live inside the app bar because that is their only home.
Page-specific UI and behavior stay with their page.

`features/` holds application capabilities and state used independently of a
particular screen. For example, `ProjectService` serves startup, the project
scope and the project switcher. It owns the collection and selection, while the
switcher owns how the user operates the menu. `core/platform/` isolates web and
Tauri capabilities; `core/connection/` owns RPC transport. Root `app.*` files assemble these
pieces. Shared visual primitives live in `apps/client/projects/ui`.

Each application component has its own folder, containing its implementation,
template and test. A page or shell component can use its existing owning folder;
additional components get named subfolders, such as `app-bar/breadcrumbs/` and
`project-switcher/project-menu/`. The root `AppComponent` remains beside `app.*`.

Use `@features/`, `@core/`, `@pages/` and `@shell/` for imports across these
folders and relative imports within an owning folder. Import the owning file
directly. A page can use shared state without another page importing its internals;
shared state and transport should not depend on pages or shell UI.

For example, a composer used only on the session page belongs to that page. The folder
browser used only by the project menu belongs to the switcher. Move state or controls
to a shared home when another owner needs them; do not pre-create folders for
future workflows or documents. These placement rules are conventions; existing
dependency checks do not enforce every frontend ownership rule.

## Pages and panels

Pages are ordinary routes in `app.routes.ts`; each fills the main panel. A route
names itself in the breadcrumbs with its own `data: { crumb }`. Two lists generate
both routes and sidebar entries, so adding a page is one entry: `workspacePages`
in `pages/workspace.ts` and `settingsSections` in `pages/settings/settings.ts`.
The first workspace page is home; the breadcrumbs' home button stands for it.

Project pages are children of `ProjectScopeComponent`. Without a selected project
it shows a short introduction in place of the page, without changing the URL,
and its button opens the project menu through `LayoutService.showProjectMenu()`.
Choosing a project then shows the page the user asked for. Settings sit outside
the scope.

The shell renders one `SidebarComponent`. It lists the workspace pages, or the
settings pages while a route with `data: { sidebar: "settings" }` is open.
`injectRouteTrail()` in `shell/route-trail.ts` gives the sidebar, the breadcrumbs and
the shell one signal that follows navigation.

The sidebar collapses to an icon rail. Resting the pointer on the rail peeks the
full sidebar over the main panel without changing the layout; leaving the rail,
Escape or a navigation closes it. The right panel and the terminal are toggled by
the user only, never by a page. `LayoutService` holds which panels are open and
their sizes for as long as the client runs; nothing is saved, so every start
uses the default layout. Collapsing a panel keeps its component mounted.

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

`ProjectService` holds the active project and the projects the user can return to.
The backend owns that list; see [User data](user-data.md). `AppComponent` calls
`load()` once at startup to read the list and select the most recently opened
project. Explicitly opening a project changes the selection only after the backend
confirms it opened. The selection lives only in memory; choosing a startup or
replacement selection never alters the server's shared project list.

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

Forgetting the selected project selects the first remaining project in the
backend's most-recently-opened order. Forgetting another project preserves the
selection. `active()` is null only when no project is selected.

Projects are chosen in one menu: the dropdown on the project name in the app bar.
`ProjectSwitcherComponent` is that name and its `brn-popover`; the app bar only
places it. The popover owns its open state and closes after a successful selection.
The menu uses ordinary buttons in a scrollable list, with Tab, Enter and Space
providing standard button navigation and activation.

Which project a window shows is not persisted. Every start reads the collection
and selects its first project, or none when empty; the server remembers the
projects and their order, not each window's selection.

Each row carries an always-visible settings button, because an action that only
appears on hover cannot be found by anyone who is not already looking for it. It
opens `ProjectSettingsComponent` in a dialog: the two things that are about one
project rather than about choosing one — the name Eitri shows for it, and removing
it from Eitri. Removal is styled as destructive and asks once, and it only ever
drops the record: the folder and its files are never touched. Neither outcome
emits `chosen`, so opening settings never counts as picking a project.
