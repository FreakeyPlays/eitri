import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterLink } from "@angular/router";
import { filter, map } from "rxjs";
import { NgIcon } from "@ng-icons/core";
import {
  lucideArrowLeft,
  lucideBookOpen,
  lucideHome,
  lucidePlus,
  lucideSettings,
  lucideSquareKanban,
} from "@ng-icons/lucide";
import { HlmButton } from "@ui/button";
import { HlmSeparator } from "@ui/separator";
import { HlmSidebarContent, HlmSidebarFooter, HlmSidebarHeader } from "@ui/sidebar";
import { settingsSections } from "@pages/settings/settings";
import { LayoutService } from "@shell/layout/layout.service";
import { SidebarItemComponent } from "./sidebar-item/sidebar-item.component";

const workspacePages = [
  { link: "/overview", label: "Overview", icon: lucideHome },
  { link: "/manage", label: "Manage", icon: lucideSquareKanban },
  { link: "/wiki", label: "Wiki", icon: lucideBookOpen },
];

const inSettings = (url: string) => url === "/settings" || url.startsWith("/settings/");

/** The shell's only sidebar: workspace navigation, or the settings pages while one is open. */
@Component({
  selector: "app-sidebar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HlmSidebarHeader,
    HlmSidebarContent,
    HlmSidebarFooter,
    HlmButton,
    HlmSeparator,
    NgIcon,
    RouterLink,
    SidebarItemComponent,
  ],
  templateUrl: "./sidebar.component.html",
  host: { class: "flex min-h-0 flex-1 flex-col" },
})
export class SidebarComponent {
  private readonly router = inject(Router);
  private readonly layout = inject(LayoutService);
  protected readonly expanded = computed(() => this.layout.isOpen("sidebar"));
  protected readonly settings = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => inSettings(event.urlAfterRedirects)),
    ),
    { initialValue: inSettings(this.router.url) },
  );
  protected readonly workspacePages = workspacePages;
  protected readonly settingsSections = settingsSections;
  protected readonly icons = { lucideArrowLeft, lucidePlus, lucideSettings };
}
