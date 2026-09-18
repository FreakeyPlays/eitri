import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideSpartanHlm } from "@ui/utils";
import { AppBarComponent } from "./app-bar.component";
import { LayoutService, type Panel } from "@shell/layout/layout.service";

describe("AppBarComponent", () => {
  const offered = signal<Panel[]>([]);
  const open = signal<Panel[]>([]);
  const toggle = vi.fn();

  beforeEach(() => {
    toggle.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideSpartanHlm(),
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
    return { element, labels };
  }

  it("offers toggles only for the panels the page has", async () => {
    expect((await render(["bottom", "right"])).labels()).toEqual([
      "Expand sidebar",
      "Show terminal",
      "Show right panel",
    ]);
  });

  it("hides the panel group on pages without panels", async () => {
    const { element, labels } = await render([], ["sidebar"]);
    expect(labels()).toEqual(["Collapse sidebar"]);
    expect(element.querySelector('[aria-label="Workspace panels"]')).toBeNull();
  });

  it("toggles through the layout and reflects open panels", async () => {
    const { element, labels } = await render(["bottom", "right"], ["bottom"]);
    expect(labels()).toEqual(["Expand sidebar", "Hide terminal", "Show right panel"]);
    const buttons = element.querySelectorAll("button");
    expect(buttons[1].getAttribute("aria-expanded")).toBe("true");
    for (const button of buttons) button.click();
    expect(toggle.mock.calls).toEqual([["sidebar"], ["bottom"], ["right"]]);
  });
});
