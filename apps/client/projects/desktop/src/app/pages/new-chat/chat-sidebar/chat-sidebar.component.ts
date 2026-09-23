import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { Router } from "@angular/router";
import { HlmSidebarContent, HlmSidebarFooter, HlmSidebarHeader } from "@ui/sidebar";
import { SettingsIcon, SquarePenIcon } from "ng-animated-icons";
import { LayoutService } from "@shell/layout/layout.service";
import { SidebarItemComponent } from "@shell/sidebar/sidebar-item/sidebar-item.component";

@Component({
  selector: "app-chat-sidebar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HlmSidebarHeader,
    HlmSidebarContent,
    HlmSidebarFooter,
    SidebarItemComponent,
    SquarePenIcon,
    SettingsIcon,
  ],
  templateUrl: "./chat-sidebar.component.html",
  host: { class: "flex min-h-0 flex-1 flex-col" },
})
export class ChatSidebarComponent {
  protected readonly router = inject(Router);
  private readonly layout = inject(LayoutService);
  protected readonly expanded = computed(() => this.layout.isOpen("sidebar"));
}
