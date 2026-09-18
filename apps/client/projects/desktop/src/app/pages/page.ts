import type { Type } from "@angular/core";
import type { Route, Router } from "@angular/router";
import type { Command } from "@shell/commands/command";

/**
 * Everything a page puts on screen. The shell renders each component in its region:
 *
 * ```
 * ┌─────────┬──────────────┬───────┐
 * │ sidebar │ main         │ right │
 * │         ├──────────────┤       │
 * │         │ bottom       │       │
 * └─────────┴──────────────┴───────┘
 * ```
 *
 * Leave `right` or `bottom` out and the page hides that panel and its toggles;
 * the user's choice is remembered for pages that have it.
 */
export interface Page {
  /** URL without a leading slash; `""` is the start page. */
  path: string;
  main: Type<unknown>;
  /** Icon rail while collapsed, full sidebar while expanded. */
  sidebar: Type<unknown>;
  right?: Type<unknown>;
  /** Shown as the terminal. */
  bottom?: Type<unknown>;
  /** Offered by the command palette after the app commands while this page is open. */
  commands?: readonly Command[];
}

/** The route that opens a page; list it in `app.routes.ts`. */
export function pageRoute(page: Page): Route {
  return { path: page.path, pathMatch: "full", component: page.main, data: { page } };
}

/** The page the router shows, or undefined before the first navigation. */
export function activePage(router: Router): Page | undefined {
  let route = router.routerState.snapshot.root;
  while (route.firstChild) route = route.firstChild;
  return route.data["page"];
}
