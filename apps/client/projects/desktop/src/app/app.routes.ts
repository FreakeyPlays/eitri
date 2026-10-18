import { Routes } from "@angular/router";
import { ProjectScopeComponent } from "@features/projects/project-scope/project-scope.component";
import { ManageComponent } from "@pages/manage/manage.component";
import { NewSessionComponent } from "@pages/new-session/new-session.component";
import { OverviewComponent } from "@pages/overview/overview.component";
import { settingsRoute } from "@pages/settings/settings";
import { WikiComponent } from "@pages/wiki/wiki.component";

/**
 * Every page of Eitri. Each fills the main panel; the shell owns everything around it.
 * `data: { crumb }` names a page in the app bar's breadcrumbs; the overview stays unnamed.
 */
export const routes: Routes = [
  settingsRoute,
  {
    // Pages that work inside a project; without one, the scope introduces projects instead.
    path: "",
    component: ProjectScopeComponent,
    children: [
      { path: "", pathMatch: "full", redirectTo: "overview" },
      { path: "overview", component: OverviewComponent },
      { path: "manage", component: ManageComponent, data: { crumb: "Manage" } },
      { path: "wiki", component: WikiComponent, data: { crumb: "Wiki" } },
      { path: "sessions/new", component: NewSessionComponent, data: { crumb: "New session" } },
    ],
  },
  { path: "**", redirectTo: "" },
];
