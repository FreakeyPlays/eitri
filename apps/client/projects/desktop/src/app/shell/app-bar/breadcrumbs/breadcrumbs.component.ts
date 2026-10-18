import { ChangeDetectionStrategy, Component, computed } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { NgIcon, provideIcons } from "@ng-icons/core";
import { lucideHome } from "@ng-icons/lucide";
import { HlmButton } from "@ui/button";
import { injectRouteTrail } from "@shell/route-trail";
import { homePage } from "@pages/workspace";
import { ProjectSwitcherComponent } from "../project-switcher/project-switcher.component";

/**
 * Where the user is: home, the project switcher, then the trail of the open page.
 * Each route that names itself with its own `data: { crumb: "…" }` adds a crumb, outermost first.
 */
@Component({
  selector: "app-breadcrumbs",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, NgIcon, ProjectSwitcherComponent, RouterLink, RouterLinkActive],
  providers: [provideIcons({ lucideHome })],
  templateUrl: "./breadcrumbs.component.html",
  host: { class: "contents" },
})
export class BreadcrumbsComponent {
  private readonly trail = injectRouteTrail();
  protected readonly home = homePage;
  protected readonly crumbs = computed(() =>
    this.trail().flatMap((route) => {
      const label: unknown = route.routeConfig?.data?.["crumb"];
      return typeof label === "string" ? [label] : [];
    }),
  );
}
