import type { Type } from "@angular/core";
import type { Route } from "@angular/router";
import {
  lucideBot,
  lucideFileQuestion,
  lucideNotebook,
  lucidePalette,
  lucideWrench,
} from "@ng-icons/lucide";
import { AppearanceComponent } from "./appearance/appearance.component";
import { PreferencesComponent } from "./preferences/preferences.component";
import { ProvidersComponent } from "./providers/providers.component";
import { SkillsComponent } from "./skills/skills.component";
import { EmptyPanelComponent } from "@shell/empty-panel/empty-panel.component";

interface SettingsSection {
  /** Heading above the pages in the sidebar; leave it out to show the pages without one. */
  label?: string;
  pages: { path: string; label: string; icon: string; component: Type<unknown> }[];
}

/**
 * Every settings page, grouped as the settings sidebar shows them.
 * Add a page here and it gets its route under `/settings` and its sidebar entry.
 */
export const settingsSections: SettingsSection[] = [
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
  {
    label: "Section",
    pages: [
      {
        path: "demo",
        label: "Section Item",
        icon: lucideFileQuestion,
        component: EmptyPanelComponent,
      },
    ],
  },
];

const settingsPages = settingsSections.flatMap((section) => section.pages);

/** `/settings` opens the first page; list this route in `app.routes.ts`. */
export const settingsRoute: Route = {
  path: "settings",
  children: [
    { path: "", pathMatch: "full", redirectTo: settingsPages[0].path },
    ...settingsPages.map(({ path, component }) => ({ path, component })),
  ],
};
