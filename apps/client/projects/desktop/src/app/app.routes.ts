import { Routes } from "@angular/router";
import { ProjectScopeComponent } from "@features/projects/project-scope/project-scope.component";
import { NewSessionComponent } from "@pages/new-session/new-session.component";
import { settingsRoute } from "@pages/settings/settings";
import { workspaceRoutes } from "@pages/workspace";

/**
 * Every page of Eitri. Each fills the main panel; the shell owns everything around it.
 * `data: { crumb }` names a page in the app bar's breadcrumbs.
 */
export const routes: Routes = [
  settingsRoute,
  {
    // Pages that work inside a project; without one, the scope introduces projects instead.
    path: "",
    component: ProjectScopeComponent,
    children: [
      ...workspaceRoutes,
      { path: "sessions/new", component: NewSessionComponent, data: { crumb: "New session" } },
    ],
  },
  { path: "**", redirectTo: "" },
];
