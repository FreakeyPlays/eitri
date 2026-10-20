import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { settingsRoute, settingsSections } from "./settings";

describe("settings routes", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([settingsRoute])] });
  });

  it("redirects the settings root to appearance", async () => {
    const router = TestBed.inject(Router);
    expect(await router.navigateByUrl("/settings")).toBe(true);
    expect(router.url).toBe("/settings/appearance");
  });

  it.each(settingsSections.flatMap((section) => section.pages))(
    "opens the explicit $label settings page instead of redirecting it",
    async ({ path, label, component }) => {
      const router = TestBed.inject(Router);
      expect(await router.navigateByUrl(`/settings/${path}`)).toBe(true);
      expect(router.url).toBe(`/settings/${path}`);
      const page = router.routerState.snapshot.root.firstChild!.firstChild!;
      expect(page.component).toBe(component);
      expect(page.data["crumb"]).toBe(label);
    },
  );
});
