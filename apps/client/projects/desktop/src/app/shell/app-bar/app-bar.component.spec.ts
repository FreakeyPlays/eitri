import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { provideSpartanHlm } from "@ui/utils";
import { ProjectService } from "@features/projects/project.service";
import { AppBarComponent } from "./app-bar.component";
import { LayoutService, type Panel } from "@shell/layout/layout.service";

describe("AppBarComponent", () => {
  const open = signal<Panel[]>([]);
  const toggle = vi.fn();
  /** Just enough for the project switcher to name "no project"; its own spec covers the rest. */
  const projects = { active: signal(null), projects: signal([]), menuRequested: signal(0) };

  beforeEach(() => {
    toggle.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideSpartanHlm(),
        provideRouter([]),
        { provide: ProjectService, useValue: projects },
        {
          provide: LayoutService,
          useValue: {
            isOpen: (panel: Panel) => open().includes(panel),
            toggle,
          },
        },
      ],
    });
  });

  async function render(opened: Panel[] = []) {
    open.set(opened);
    const fixture = TestBed.createComponent(AppBarComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const labels = () =>
      [...element.querySelectorAll("button")].map((button) => button.getAttribute("aria-label"));
    return { element, labels };
  }

  it("always offers the terminal and right panel toggles", async () => {
    expect((await render()).labels()).toEqual([
      "Expand sidebar",
      "Open a project",
      "Show terminal",
      "Show right panel",
    ]);
  });

  it.each([
    { opened: [], sidebar: "lucidePanelLeft", right: "lucidePanelRight" },
    {
      opened: ["sidebar", "right"] satisfies Panel[],
      sidebar: "lucidePanelLeftClose",
      right: "lucidePanelRightClose",
    },
  ])("renders static icons for $sidebar and $right", async ({ opened, sidebar, right }) => {
    const { element } = await render(opened);
    const icons = [...element.querySelectorAll("button ng-icon")];

    expect(icons.map((icon) => icon.getAttribute("name"))).toEqual([
      sidebar,
      "lucideChevronsUpDown",
      "lucideSquareTerminal",
      right,
    ]);
    expect(icons.every((icon) => icon.querySelector("svg") !== null)).toBe(true);
    expect(icons.every((icon) => icon.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  it("toggles through the layout and reflects open panels", async () => {
    const { element, labels } = await render(["bottom"]);
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
});
