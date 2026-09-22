import { computed, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { Project } from "@eitri/contracts/project";
import { provideSpartanHlm } from "@ui/utils";
import { ProjectService } from "@core/projects/project.service";
import { LayoutService } from "@shell/layout/layout.service";
import { ProjectSwitcherComponent } from "./project-switcher.component";

const eitri = {
  id: "ca0dcace-34da-4b44-8364-13ce54a32e44",
  path: "/git/eitri",
  name: "eitri",
  lastOpenedAt: "2026-09-21T10:00:00.000Z",
};

describe("ProjectSwitcherComponent", () => {
  const active = signal<Project | null>(null);
  const listed = signal<Project[]>([]);
  /** Complete enough for the switcher and the menu it opens. */
  const projects = {
    active,
    projects: listed,
    allSelected: computed(() => active() === null),
    error: signal(null),
    busy: signal(false),
    loaded: signal(true),
    canPickFolder: false,
    load: vi.fn(),
    open: vi.fn(),
    openAll: vi.fn(),
    forget: vi.fn(),
    pickFolder: vi.fn(),
    listFolders: vi.fn(),
  };

  beforeEach(() => {
    active.set(null);
    listed.set([]);
    TestBed.configureTestingModule({
      providers: [provideSpartanHlm(), { provide: ProjectService, useValue: projects }],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(ProjectSwitcherComponent);
    await fixture.whenStable();
    const trigger = () =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        'button[aria-haspopup="true"]',
      )!;
    return { fixture, trigger };
  }

  it("names what the user works in", async () => {
    const { fixture, trigger } = await render();
    expect(trigger().textContent?.trim()).toBe("No project");
    expect(trigger().getAttribute("aria-label")).toBe("Open a project");

    active.set(eitri);
    listed.set([eitri]);
    await fixture.whenStable();
    expect(trigger().textContent?.trim()).toBe("eitri");
    expect(trigger().getAttribute("aria-label")).toBe("Project eitri. Switch project.");
    expect(trigger().title).toBe("/git/eitri");

    // Nothing selected while projects exist means all of them, not none.
    active.set(null);
    await fixture.whenStable();
    expect(trigger().textContent?.trim()).toBe("All projects");
  });

  it("drops the project menu open beneath the name, without a dialog", async () => {
    const { fixture, trigger } = await render();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");

    trigger().click();
    await fixture.whenStable();

    const menu = await vi.waitFor(() => {
      const opened = document.querySelector("app-project-menu");
      expect(opened).not.toBeNull();
      return opened!;
    });
    // A dropdown anchored to the trigger, not a modal over the whole window.
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(menu.textContent).toContain("No projects yet");
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
  });

  it("opens the same menu when the palette asks for it", async () => {
    const { fixture, trigger } = await render();

    TestBed.inject(LayoutService).projectMenu.set("open");
    await fixture.whenStable();

    await vi.waitFor(() => expect(document.querySelector("app-project-menu")).not.toBeNull());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
  });
});
