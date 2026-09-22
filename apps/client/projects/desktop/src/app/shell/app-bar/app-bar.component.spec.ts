import { computed, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { Project } from "@eitri/contracts/project";
import { provideSpartanHlm } from "@ui/utils";
import { ProjectService } from "@core/projects/project.service";
import { AppBarComponent } from "./app-bar.component";
import { LayoutService, type Panel } from "@shell/layout/layout.service";

describe("AppBarComponent", () => {
  const offered = signal<Panel[]>([]);
  const open = signal<Panel[]>([]);
  const active = signal<Project | null>(null);
  const toggle = vi.fn();
  const listed = signal<Project[]>([]);
  /** Complete enough for the app bar and the dropdown it opens. */
  const projects = {
    active,
    projects: listed,
    allSelected: computed(() => active() === null),
    notice: signal(null),
    error: signal(null),
    busy: signal(false),
    canBrowse: false,
    load: vi.fn(),
    open: vi.fn(),
    openAll: vi.fn(),
    forget: vi.fn(),
    browse: vi.fn(),
  };

  beforeEach(() => {
    toggle.mockReset();
    active.set(null);
    listed.set([]);
    TestBed.configureTestingModule({
      providers: [
        provideSpartanHlm(),
        { provide: ProjectService, useValue: projects },
        {
          provide: LayoutService,
          useValue: {
            has: (panel: Panel) => panel === "sidebar" || offered().includes(panel),
            isOpen: (panel: Panel) => open().includes(panel),
            toggle,
          },
        },
      ],
    });
  });

  async function render(panels: Panel[], opened: Panel[] = []) {
    offered.set(panels);
    open.set(opened);
    const fixture = TestBed.createComponent(AppBarComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const labels = () =>
      [...element.querySelectorAll("button")].map((button) => button.getAttribute("aria-label"));
    // The one button that opens a menu is the project trigger, whatever it is named.
    const project = () => element.querySelector<HTMLButtonElement>('button[aria-haspopup="true"]')!;
    return { fixture, element, labels, project };
  }

  it("offers toggles only for the panels the page has", async () => {
    expect((await render(["bottom", "right"])).labels()).toEqual([
      "Expand sidebar",
      "Open a project",
      "Show terminal",
      "Show right panel",
    ]);
  });

  it("hides the panel group on pages without panels", async () => {
    const { element, labels } = await render([], ["sidebar"]);
    expect(labels()).toEqual(["Collapse sidebar", "Open a project"]);
    expect(element.querySelector('[aria-label="Workspace panels"]')).toBeNull();
  });

  it("toggles through the layout and reflects open panels", async () => {
    const { element, labels } = await render(["bottom", "right"], ["bottom"]);
    expect(labels()).toEqual([
      "Expand sidebar",
      "Open a project",
      "Hide terminal",
      "Show right panel",
    ]);
    const buttons = [...element.querySelectorAll("button")].filter(
      (button) => button.getAttribute("aria-label") !== "Open a project",
    );
    expect(buttons[1].getAttribute("aria-expanded")).toBe("true");
    for (const button of buttons) button.click();
    expect(toggle.mock.calls).toEqual([["sidebar"], ["bottom"], ["right"]]);
  });

  it("names what the user works in on every page", async () => {
    const eitri = {
      id: "ca0dcace-34da-4b44-8364-13ce54a32e44",
      path: "/git/eitri",
      name: "eitri",
      lastOpenedAt: "2026-09-21T10:00:00.000Z",
    };
    const { fixture, project } = await render([]);
    expect(project().textContent?.trim()).toBe("No project");

    active.set(eitri);
    listed.set([eitri]);
    await fixture.whenStable();
    expect(project().textContent?.trim()).toBe("eitri");
    expect(project().getAttribute("aria-label")).toBe("Project eitri. Switch project.");

    // Nothing selected while projects exist means all of them, not none.
    active.set(null);
    await fixture.whenStable();
    expect(project().textContent?.trim()).toBe("All projects");
  });

  it("drops the project menu open from the app bar, without a dialog", async () => {
    const { fixture, project } = await render([]);
    expect(project().getAttribute("aria-expanded")).toBe("false");

    project().click();
    await fixture.whenStable();

    const menu = await vi.waitFor(() => {
      const opened = document.querySelector("app-project-menu");
      expect(opened).not.toBeNull();
      return opened!;
    });
    // A dropdown anchored to the trigger, not a modal over the whole window.
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(menu.textContent).toContain("No projects yet");
    expect(project().getAttribute("aria-expanded")).toBe("true");
  });
});
