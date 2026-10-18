import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
  type ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
} from "@angular/router";
import { filter, map } from "rxjs";
import { NgIcon, provideIcons } from "@ng-icons/core";
import { lucideHome } from "@ng-icons/lucide";
import { HlmButton } from "@ui/button";
import { ProjectSwitcherComponent } from "../project-switcher/project-switcher.component";

/** One crumb per activated route that names itself with its own `data: { crumb: "…" }`, outermost first. */
function crumbsOf(router: Router): string[] {
  const crumbs: string[] = [];
  let route: ActivatedRouteSnapshot | null = router.routerState.snapshot.root;
  for (; route; route = route.firstChild) {
    const label: unknown = route.routeConfig?.data?.["crumb"];
    if (typeof label === "string") crumbs.push(label);
  }
  return crumbs;
}

/** Where the user is: home to the overview, the project switcher, then the trail of the open page. */
@Component({
  selector: "app-breadcrumbs",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, NgIcon, ProjectSwitcherComponent, RouterLink, RouterLinkActive],
  providers: [provideIcons({ lucideHome })],
  templateUrl: "./breadcrumbs.component.html",
  host: { class: "contents" },
})
export class BreadcrumbsComponent {
  private readonly router = inject(Router);
  protected readonly crumbs = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => crumbsOf(this.router)),
    ),
    { initialValue: crumbsOf(this.router) },
  );
}
