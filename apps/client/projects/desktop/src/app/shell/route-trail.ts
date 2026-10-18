import { inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { type ActivatedRouteSnapshot, NavigationEnd, Router } from "@angular/router";
import { filter, map } from "rxjs";

/** The activated routes from the root down to the shown page, outermost first. */
function trailOf(router: Router) {
  const trail: ActivatedRouteSnapshot[] = [];
  for (let route = router.routerState.snapshot.root.firstChild; route; route = route.firstChild) {
    trail.push(route);
  }
  return trail;
}

/**
 * The route trail after the latest completed navigation, as a signal.
 * Read it in `computed` or `effect` to follow the page; call in an injection context.
 */
export function injectRouteTrail() {
  const router = inject(Router);
  return toSignal(
    router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => trailOf(router)),
    ),
    { initialValue: trailOf(router) },
  );
}
