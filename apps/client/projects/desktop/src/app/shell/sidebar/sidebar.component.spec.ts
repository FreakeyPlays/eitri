import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { provideSpartanHlm } from "@ui/utils";
import { settingsRoute } from "@pages/settings/settings";
import { LayoutService } from "@shell/layout/layout.service";
import { SidebarComponent } from "./sidebar.component";

// The real settings pages, followed by a labelled and an unlabelled section to cover both headings.
vi.mock("@pages/settings/settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pages/settings/settings")>();
  return {
    ...actual,
    settingsSections: [...actual.settingsSections, { label: "Agents", pages: [] }, { pages: [] }],
  };
});

@Component({ template: "" })
class BlankComponent {}

describe("SidebarComponent", () => {
  const sidebarExpanded = signal(true);

  beforeEach(() => {
    sidebarExpanded.set(true);
    TestBed.configureTestingModule({
      providers: [
        provideSpartanHlm(),
        provideRouter([
          { path: "", pathMatch: "full", redirectTo: "overview" },
          { path: "overview", component: BlankComponent },
          settingsRoute,
        ]),
        { provide: LayoutService, useValue: { sidebarShown: sidebarExpanded } },
      ],
    });
  });

  async function render(url: string) {
    const fixture = TestBed.createComponent(SidebarComponent);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const links = () =>
      [...element.querySelectorAll("a")].map((link) => [
        link.getAttribute("aria-label") ?? link.textContent?.trim(),
        link.getAttribute("href"),
      ]);
    return { fixture, element, links };
  }

  it("shows the workspace pages, sessions, and settings", async () => {
    const { element, links } = await render("/overview");
    expect(element.getAttribute("role")).toBe("navigation");
    expect(element.getAttribute("aria-label")).toBe("Workspace");
    expect(links()).toEqual([
      ["Overview", "/overview"],
      ["Manage", "/manage"],
      ["Wiki", "/wiki"],
      ["New session", "/sessions/new"],
      ["Settings", "/settings"],
    ]);
    expect(element.querySelector('a[aria-current="page"]')?.getAttribute("aria-label")).toBe(
      "Overview",
    );
  });

  it("puts search and filter beside new session in the sessions toolbar", async () => {
    const { element } = await render("/overview");
    const sessions = element.querySelector('[aria-label="Sessions"]')!;
    expect(sessions.querySelector("h2")).toBeNull();
    expect(sessions.querySelector('input[aria-label="Search sessions"]')).not.toBeNull();
    expect(sessions.querySelector('button[aria-label="Filter sessions"]')).not.toBeNull();
    expect(sessions.querySelector('a[aria-label="New session"]')?.getAttribute("href")).toBe(
      "/sessions/new",
    );
  });

  it("swaps to the settings pages and back with the URL", async () => {
    const { fixture, element, links } = await render("/settings");
    expect(element.getAttribute("aria-label")).toBe("Settings");
    expect(links()).toEqual([
      ["Appearance", "/settings/appearance"],
      ["Preferences", "/settings/preferences"],
      ["Providers", "/settings/providers"],
      ["Skills", "/settings/skills"],
      ["Back", "/"],
    ]);
    expect(element.querySelector('a[aria-current="page"]')?.getAttribute("aria-label")).toBe(
      "Appearance",
    );

    element.querySelector<HTMLAnchorElement>('a[aria-label="Back"]')!.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe("/overview");
    expect(element.getAttribute("aria-label")).toBe("Workspace");
    expect(element.querySelector('a[aria-label="Settings"]')).not.toBeNull();
  });

  it("heads only labelled sections, keeping the gap between sections either way", async () => {
    const { element } = await render("/settings");
    const [first, labelled, unlabelled] = element.querySelectorAll("section");

    expect(first.querySelector("h2")).toBeNull();
    expect(first.hasAttribute("aria-label")).toBe(false);
    expect(first.classList).not.toContain("pt-3");

    expect(labelled.querySelector("h2")?.textContent?.trim()).toBe("Agents");
    expect(labelled.getAttribute("aria-label")).toBe("Agents");
    expect(labelled.classList).not.toContain("pt-3");

    expect(unlabelled.querySelector("h2")).toBeNull();
    expect(unlabelled.hasAttribute("aria-label")).toBe(false);
    expect(unlabelled.classList).toContain("pt-3");
  });

  it("keeps only the icon rail, with new session set apart, while collapsed", async () => {
    const { fixture, element, links } = await render("/overview");
    sidebarExpanded.set(false);
    await fixture.whenStable();
    expect(element.querySelector('[aria-label="Sessions"]')).toBeNull();
    expect(links().map(([label]) => label)).toEqual([
      "Overview",
      "Manage",
      "Wiki",
      "New session",
      "Settings",
    ]);
    expect(element.querySelectorAll("a ng-icon svg")).toHaveLength(5);
  });
});
