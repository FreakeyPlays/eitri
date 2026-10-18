import { Routes } from "@angular/router";
import { ManageComponent } from "@pages/manage/manage.component";
import { NewSessionComponent } from "@pages/new-session/new-session.component";
import { OverviewComponent } from "@pages/overview/overview.component";
import { settingsRoute } from "@pages/settings/settings";
import { WikiComponent } from "@pages/wiki/wiki.component";

/** Every page of Eitri. Each fills the main panel; the shell owns everything around it. */
export const routes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "overview" },
  { path: "overview", component: OverviewComponent },
  { path: "manage", component: ManageComponent },
  { path: "wiki", component: WikiComponent },
  { path: "sessions/new", component: NewSessionComponent },
  settingsRoute,
  { path: "**", redirectTo: "" },
];
