import type { Routes } from "@angular/router";
import { lucideBookOpen, lucideHome, lucideSquareKanban } from "@ng-icons/lucide";
import { ManageComponent } from "./manage/manage.component";
import { OverviewComponent } from "./overview/overview.component";
import { WikiComponent } from "./wiki/wiki.component";

/**
 * The pages of a project, in the order the sidebar lists them.
 * Add a page here and it gets its route and its sidebar entry.
 * The first is home: the breadcrumbs' home button stands for it, so it gets no crumb.
 */
export const workspacePages = [
  { path: "overview", label: "Overview", icon: lucideHome, component: OverviewComponent },
  { path: "manage", label: "Manage", icon: lucideSquareKanban, component: ManageComponent },
  { path: "wiki", label: "Wiki", icon: lucideBookOpen, component: WikiComponent },
] as const;

export const homePage = workspacePages[0];

/** Routes for the pages above; `app.routes.ts` nests them in the project scope. */
export const workspaceRoutes: Routes = [
  { path: "", pathMatch: "full", redirectTo: homePage.path },
  ...workspacePages.map(({ path, label, component }) => ({
    path,
    component,
    data: path === homePage.path ? undefined : { crumb: label },
  })),
];
