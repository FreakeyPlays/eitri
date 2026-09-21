import { EmptyPanelComponent } from "./empty-panel.component";
import type { Page } from "@pages/page";
import { ChatSidebarComponent } from "./chat-sidebar.component";
import { NewChatComponent } from "./new-chat.component";

/** The start page: pick a project and start a chat. */
export const newChatPage: Page = {
  path: "",
  main: NewChatComponent,
  sidebar: ChatSidebarComponent,
  right: EmptyPanelComponent,
  bottom: EmptyPanelComponent,
};
