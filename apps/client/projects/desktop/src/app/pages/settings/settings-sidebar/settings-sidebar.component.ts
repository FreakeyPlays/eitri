import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { HlmSidebarContent, HlmSidebarHeader } from "@ui/sidebar";
import { NgIcon, provideIcons } from "@ng-icons/core";
import { lucideArrowLeft, lucideSlidersHorizontal } from "@ng-icons/lucide";
import { SidebarItemComponent } from "@shell/sidebar/sidebar-item/sidebar-item.component";

@Component({
  selector: "app-settings-sidebar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmSidebarHeader, HlmSidebarContent, SidebarItemComponent, NgIcon],
  providers: [provideIcons({ lucideArrowLeft, lucideSlidersHorizontal })],
  templateUrl: "./settings-sidebar.component.html",
  host: { class: "flex min-h-0 flex-1 flex-col" },
})
export class SettingsSidebarComponent {
  protected readonly router = inject(Router);
}
