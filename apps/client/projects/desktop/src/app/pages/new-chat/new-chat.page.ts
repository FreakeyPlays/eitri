import { inject } from "@angular/core";
import { HlmDialogService } from "@ui/dialog";
import { EmptyPanelComponent } from "./empty-panel.component";
import type { Page } from "@pages/page";
import { openAddProjectDialog } from "./add-project-dialog.component";
import { ChatSidebarComponent } from "./chat-sidebar.component";
import { NewChatComponent } from "./new-chat.component";

/** The start page: pick a project and start a chat. */
export const newChatPage: Page = {
  path: "",
  main: NewChatComponent,
  sidebar: ChatSidebarComponent,
  right: EmptyPanelComponent,
  bottom: EmptyPanelComponent,
  commands: [
    {
      group: "Projects",
      label: "Add Project",
      run: () => openAddProjectDialog(inject(HlmDialogService)),
    },
  ],
};
