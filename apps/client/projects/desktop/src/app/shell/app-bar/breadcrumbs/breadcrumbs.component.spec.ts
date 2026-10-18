import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { provideSpartanHlm } from "@ui/utils";
import { ProjectService } from "@features/projects/project.service";
import { settingsRoute } from "@pages/settings/settings";
import { BreadcrumbsComponent } from "./breadcrumbs.component";

@Component({ template: "" })
class BlankComponent {}

describe("BreadcrumbsComponent", () => {
  /** Just enough for the project switcher to name "no project"; its own spec covers the rest. */
  const projects = { active: signal(null), projects: signal([]), menuRequested: signal(0) };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideSpartanHlm(),
        provideRouter([
          settingsRoute,
          { path: "overview", component: BlankComponent },
          { path: "wiki", component: BlankComponent, data: { crumb: "Wiki" } },
        ]),
        { provide: ProjectService, useValue: projects },
      ],
    });
  });

  async function render(url: string) {
    const fixture = TestBed.createComponent(BreadcrumbsComponent);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const trail = () =>
      [...element.querySelectorAll("li")].map((item) => {
        const home = item.querySelector("a");
        if (home)
          return [home.getAttribute("aria-label"), home.getAttribute("aria-current") ?? "home"];
        const button = item.querySelector("button");
        if (button) return [button.textContent?.trim(), "switcher"];
        const crumb = item.querySelector("span:not([aria-hidden])")!;
        return [crumb.textContent?.trim(), crumb.getAttribute("aria-current") ?? "label"];
      });
    return { fixture, trail };
  }

  it("marks home as the current page on the overview", async () => {
    const { trail } = await render("/overview");
    expect(trail()).toEqual([
      ["Overview", "page"],
      ["Select Project", "switcher"],
    ]);
  });

  it("names the open page after the project switcher", async () => {
    const { trail } = await render("/wiki");
    expect(trail()).toEqual([
      ["Overview", "home"],
      ["Select Project", "switcher"],
      ["Wiki", "page"],
    ]);
  });

  it("names nested pages without links and follows navigation home", async () => {
    const { fixture, trail } = await render("/settings/appearance");
    expect(trail()).toEqual([
      ["Overview", "home"],
      ["Select Project", "switcher"],
      ["Settings", "label"],
      ["Appearance", "page"],
    ]);

    fixture.nativeElement.querySelector('a[aria-label="Overview"]').click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe("/overview");
    expect(trail()).toEqual([
      ["Overview", "page"],
      ["Select Project", "switcher"],
    ]);
  });
});
