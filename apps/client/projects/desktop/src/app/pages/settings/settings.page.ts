import type { Page } from "@pages/page";
import { SettingsSidebarComponent } from "./settings-sidebar.component";
import { SettingsComponent } from "./settings.component";

/** Settings, with its own sidebar and without the right panel or terminal. */
export const settingsPage: Page = {
  path: "settings",
  main: SettingsComponent,
  sidebar: SettingsSidebarComponent,
};
