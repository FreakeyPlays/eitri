import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { OverviewComponent } from "@pages/overview/overview.component";
import { injectRouteTrail } from "./route-trail";

describe("route trail", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: "project",
            children: [{ path: "overview", component: OverviewComponent }],
          },
          { path: "blocked", component: OverviewComponent, canActivate: [() => false] },
          { path: "home", component: OverviewComponent },
        ]),
      ],
    });
  });

  it("has no activated page before the first navigation", () => {
    const trail = TestBed.runInInjectionContext(injectRouteTrail);
    expect(trail()).toEqual([]);
  });

  it("starts with the current route's ancestors in outermost-first order, excluding the router root", async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl("/project/overview");
    const trail = TestBed.runInInjectionContext(injectRouteTrail);
    const project = router.routerState.snapshot.root.firstChild!;
    expect(trail()).toEqual([project, project.firstChild]);
  });

  it("changes the trail only after a navigation succeeds", async () => {
    const router = TestBed.inject(Router);
    const trail = TestBed.runInInjectionContext(injectRouteTrail);
    await router.navigateByUrl("/project/overview");
    expect(trail().map((route) => route.routeConfig?.path)).toEqual(["project", "overview"]);
    const current = trail();

    expect(await router.navigateByUrl("/blocked")).toBe(false);
    expect(trail()).toBe(current);

    expect(await router.navigateByUrl("/home")).toBe(true);
    expect(trail()).toEqual([router.routerState.snapshot.root.firstChild]);
  });
});
