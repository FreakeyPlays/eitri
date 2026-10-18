import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { provideSpartanHlm } from "@ui/utils";
import { settingsRoute, settingsSections } from "@pages/settings/settings";
import { LayoutService } from "@shell/layout/layout.service";
import { SidebarComponent } from "./sidebar.component";

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
    expect(element.querySelector("hlm-separator")).not.toBeNull();
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
    expect(links()).toEqual([
      ["Appearance", "/settings/appearance"],
      ["Preferences", "/settings/preferences"],
      ["Providers", "/settings/providers"],
      ["Skills", "/settings/skills"],
      ["Back", "/"],
    ]);
    expect([...element.querySelectorAll("section h2")].map((h) => h.textContent?.trim())).toEqual([
      "General",
      "Agents",
    ]);
    expect(element.querySelector('a[aria-current="page"]')?.getAttribute("aria-label")).toBe(
      "Appearance",
    );

    element.querySelector<HTMLAnchorElement>('a[aria-label="Back"]')!.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe("/overview");
    expect(element.querySelector('a[aria-label="Settings"]')).not.toBeNull();
  });

  it("shows a section without a label as pages only", async () => {
    settingsSections.push({ pages: [] });
    try {
      const { element } = await render("/settings");
      const unlabelled = element.querySelectorAll("section")[settingsSections.length - 1];
      expect(unlabelled.querySelector("h2")).toBeNull();
      expect(unlabelled.hasAttribute("aria-label")).toBe(false);
      expect(unlabelled.classList).toContain("pt-3");
    } finally {
      settingsSections.pop();
    }
  });

  it("aligns an unlabelled first section with the workspace pages", async () => {
    settingsSections.unshift({ pages: [] });
    try {
      const { element } = await render("/settings");
      expect(element.querySelector("section")!.classList).not.toContain("pt-3");
    } finally {
      settingsSections.shift();
    }
  });

  it("keeps only the icon rail, with new session set apart, while collapsed", async () => {
    const { fixture, element, links } = await render("/overview");
    sidebarExpanded.set(false);
    await fixture.whenStable();
    expect(element.querySelector('[aria-label="Sessions"]')).toBeNull();
    expect(element.querySelector("hlm-separator")).not.toBeNull();
    expect(links()).toContainEqual(["New session", "/sessions/new"]);
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
