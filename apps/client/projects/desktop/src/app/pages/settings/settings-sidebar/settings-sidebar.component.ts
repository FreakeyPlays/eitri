import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { HlmSidebarContent, HlmSidebarHeader } from "@ui/sidebar";
import { ArrowLeftIcon, SlidersHorizontalIcon } from "ng-animated-icons";
import { SidebarItemComponent } from "@shell/sidebar/sidebar-item/sidebar-item.component";

@Component({
  selector: "app-settings-sidebar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HlmSidebarHeader,
    HlmSidebarContent,
    SidebarItemComponent,
    ArrowLeftIcon,
    SlidersHorizontalIcon,
  ],
  templateUrl: "./settings-sidebar.component.html",
  host: { class: "flex min-h-0 flex-1 flex-col" },
})
export class SettingsSidebarComponent {
  protected readonly router = inject(Router);
}
