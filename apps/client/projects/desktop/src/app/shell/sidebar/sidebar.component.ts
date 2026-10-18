import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { NgIcon } from "@ng-icons/core";
import {
  lucideArrowLeft,
  lucideListFilter,
  lucidePlus,
  lucideSearch,
  lucideSettings,
} from "@ng-icons/lucide";
import { HlmButton } from "@ui/button";
import { HlmInputGroupImports } from "@ui/input-group";
import { HlmSidebarContent, HlmSidebarFooter, HlmSidebarHeader } from "@ui/sidebar";
import { injectRouteTrail } from "@shell/route-trail";
import { settingsSections } from "@pages/settings/settings";
import { workspacePages } from "@pages/workspace";
import { LayoutService } from "@shell/layout/layout.service";
import { SidebarItemComponent } from "./sidebar-item/sidebar-item.component";

/**
 * The shell's only sidebar: workspace navigation, or the settings pages while a route
 * with `data: { sidebar: "settings" }` is open.
 */
@Component({
  selector: "app-sidebar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HlmSidebarHeader,
    HlmSidebarContent,
    HlmSidebarFooter,
    HlmButton,
    HlmInputGroupImports,
    NgIcon,
    RouterLink,
    SidebarItemComponent,
  ],
  templateUrl: "./sidebar.component.html",
  host: {
    class: "flex min-h-0 flex-1 flex-col",
    role: "navigation",
    "[attr.aria-label]": "settings() ? 'Settings' : 'Workspace'",
  },
})
export class SidebarComponent {
  private readonly trail = injectRouteTrail();
  protected readonly expanded = inject(LayoutService).sidebarShown;
  protected readonly settings = computed(() =>
    this.trail().some((route) => route.routeConfig?.data?.["sidebar"] === "settings"),
  );
  protected readonly workspacePages = workspacePages;
  protected readonly settingsSections = settingsSections;
  protected readonly icons = {
    lucideArrowLeft,
    lucideListFilter,
    lucidePlus,
    lucideSearch,
    lucideSettings,
  };
}
