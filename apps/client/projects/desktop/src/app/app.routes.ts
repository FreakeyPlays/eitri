import { Routes } from "@angular/router";
import { newChatPage } from "@pages/new-chat/new-chat.page";
import { pageRoute } from "@pages/page";
import { settingsPage } from "@pages/settings/settings.page";

/** Every page of Eitri. Create a page in `pages/`, then list it here. */
export const routes: Routes = [
  pageRoute(newChatPage),
  pageRoute(settingsPage),
  { path: "**", redirectTo: "" },
];
