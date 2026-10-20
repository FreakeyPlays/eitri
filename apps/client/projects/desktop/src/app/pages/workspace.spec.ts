import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { workspacePages, workspaceRoutes } from "./workspace";

describe("workspace routes", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(workspaceRoutes)] });
  });

  it("redirects the workspace root to overview", async () => {
    const router = TestBed.inject(Router);
    expect(await router.navigateByUrl("/")).toBe(true);
    expect(router.url).toBe("/overview");
  });

  it.each(workspacePages)(
    "opens the explicit $label workspace page instead of redirecting it",
    async ({ path, component }) => {
      const router = TestBed.inject(Router);
      expect(await router.navigateByUrl(`/${path}`)).toBe(true);
      expect(router.url).toBe(`/${path}`);
      expect(router.routerState.snapshot.root.firstChild!.component).toBe(component);
    },
  );
});
