import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import type { Project } from "@eitri/contracts/project";
import { ProjectService } from "@features/projects/project.service";
import { ProjectScopeComponent } from "./project-scope.component";

const eitri = {
  id: "ca0dcace-34da-4b44-8364-13ce54a32e44",
  path: "/git/eitri",
  name: "eitri",
  lastOpenedAt: "2026-09-21T10:00:00.000Z",
};

@Component({ template: `<p data-page>Overview</p>` })
class PageStub {}

describe("ProjectScopeComponent", () => {
  const active = signal<Project | null>(null);
  const loaded = signal(false);
  const error = signal<string | null>(null);
  const showMenu = vi.fn();

  beforeEach(() => {
    active.set(null);
    loaded.set(false);
    error.set(null);
    showMenu.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: ProjectService, useValue: { active, loaded, error, showMenu } },
        provideRouter([
          {
            path: "",
            component: ProjectScopeComponent,
            children: [{ path: "overview", component: PageStub }],
          },
        ]),
      ],
    });
  });

  async function render() {
    const harness = await RouterTestingHarness.create("/overview");
    const element: HTMLElement = harness.fixture.nativeElement;
    return {
      fixture: harness.fixture,
      element,
      intro: () => element.querySelector("#no-project-title"),
      choose: () => element.querySelector("button"),
      page: () => element.querySelector("[data-page]"),
    };
  }

  it("shows nothing until the projects were read", async () => {
    const { element } = await render();
    expect(element.textContent?.trim()).toBe("");
  });

  it("introduces projects when none is selected", async () => {
    loaded.set(true);
    const { intro, page } = await render();
    expect(intro()?.textContent?.trim()).toBe("No project selected");
    expect(page()).toBeNull();
  });

  it("opens the title bar's project menu rather than a picker of its own", async () => {
    loaded.set(true);
    const { choose } = await render();
    choose()!.click();
    expect(showMenu).toHaveBeenCalledOnce();
  });

  it("still introduces projects when the first read failed", async () => {
    error.set("Server unreachable");
    const { intro } = await render();
    expect(intro()).not.toBeNull();
  });

  it("shows the requested page once a project is selected, on the same URL", async () => {
    loaded.set(true);
    const { fixture, intro, choose, page } = await render();

    active.set(eitri);
    await fixture.whenStable();
    expect(intro()).toBeNull();
    expect(choose()).toBeNull();
    expect(page()?.textContent).toBe("Overview");
    expect(TestBed.inject(Router).url).toBe("/overview");
  });
});
