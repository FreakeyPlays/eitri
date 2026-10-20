import type { Type } from "@angular/core";
import type { Route } from "@angular/router";
import { lucideBot, lucideNotebook, lucidePalette, lucideWrench } from "@ng-icons/lucide";
import { AppearanceComponent } from "./appearance/appearance.component";
import { PreferencesComponent } from "./preferences/preferences.component";
import { ProvidersComponent } from "./providers/providers.component";
import { SkillsComponent } from "./skills/skills.component";

export interface SettingsSection {
  /** Heading above the pages in the sidebar; leave it out to show the pages without one. */
  readonly label?: string;
  readonly pages: readonly {
    readonly path: string;
    readonly label: string;
    readonly icon: string;
    readonly component: Type<unknown>;
  }[];
}

/**
 * Every settings page, grouped as the settings sidebar shows them.
 * Add a page here and it gets its route under `/settings` and its sidebar entry.
 */
export const settingsSections: readonly SettingsSection[] = [
  {
    pages: [
      {
        path: "appearance",
        label: "Appearance",
        icon: lucidePalette,
        component: AppearanceComponent,
      },
      {
        path: "preferences",
        label: "Preferences",
        icon: lucideWrench,
        component: PreferencesComponent,
      },
      { path: "providers", label: "Providers", icon: lucideBot, component: ProvidersComponent },
      { path: "skills", label: "Skills", icon: lucideNotebook, component: SkillsComponent },
    ],
  },
];

const settingsPages = settingsSections.flatMap((section) => section.pages);

/**
 * `/settings` opens the first page; list this route in `app.routes.ts`.
 * `data.sidebar` switches the shell's sidebar to the settings pages.
 */
export const settingsRoute: Route = {
  path: "settings",
  data: { crumb: "Settings", sidebar: "settings" },
  children: [
    { path: "", pathMatch: "full", redirectTo: settingsPages[0].path },
    ...settingsPages.map(({ path, label, component }) => ({
      path,
      component,
      data: { crumb: label },
    })),
  ],
};
