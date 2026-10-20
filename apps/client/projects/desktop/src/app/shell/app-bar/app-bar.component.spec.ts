import { signal } from "@angular/core";
import { NEVER } from "rxjs";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { provideSpartanHlm } from "@ui/utils";
import { ProjectService } from "@features/projects/project.service";
import { AppBarComponent } from "./app-bar.component";
import { LayoutService, type Panel } from "@shell/layout/layout.service";

const { isTauri, getCurrentWindow } = vi.hoisted(() => ({
  isTauri: vi.fn(() => false),
  getCurrentWindow: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow }));

const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

describe("AppBarComponent", () => {
  const open = signal<Panel[]>([]);
  const toggle = vi.fn();
  const isFullscreen = vi.fn();
  const onResized = vi.fn();
  const unlisten = vi.fn();
  /** Just enough for the project switcher to name "no project"; its own spec covers the rest. */
  const projects = { active: signal(null), projects: signal([]) };

  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    toggle.mockReset();
    unlisten.mockReset();
    isTauri.mockReturnValue(false);
    isFullscreen.mockReset().mockResolvedValue(false);
    onResized.mockReset().mockResolvedValue(unlisten);
    getCurrentWindow.mockReset().mockReturnValue({ isFullscreen, onResized });
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
            projectMenuRequested: NEVER,
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
    return { fixture, element, labels };
  }

  /** Renders in the given host and lets the window's async answers land. */
  async function renderIn(tauri: boolean, userAgent: string) {
    isTauri.mockReturnValue(tauri);
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
    const view = await render();
    const header = view.element.querySelector("header")!;
    const settle = async () => {
      await new Promise<void>((resolve) => setTimeout(resolve));
      await view.fixture.whenStable();
    };
    await settle();
    return { ...view, settle, inset: () => header.classList.contains("pl-20") };
  }

  it("always offers the terminal and right panel toggles", async () => {
    expect((await render()).labels()).toEqual([
      "Expand sidebar",
      "Select Project",
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
      "Select Project",
      "Hide terminal",
      "Show right panel",
    ]);
    const buttons = [...element.querySelectorAll("button")].filter(
      (button) => button.getAttribute("aria-label") !== "Select Project",
    );
    expect(buttons[1].getAttribute("aria-expanded")).toBe("true");
    for (const button of buttons) button.click();
    expect(toggle.mock.calls).toEqual([["sidebar"], ["bottom"], ["right"]]);
  });

  describe("window controls inset", () => {
    it.each([
      { host: "a browser on a Mac", tauri: false, userAgent: mac },
      { host: "Tauri off macOS", tauri: true, userAgent: windows },
    ])("stays flush in $host", async ({ tauri, userAgent }) => {
      const { inset } = await renderIn(tauri, userAgent);
      expect(inset()).toBe(false);
      expect(getCurrentWindow).not.toHaveBeenCalled();
    });

    it("clears the macOS window buttons, except in fullscreen where they hide", async () => {
      const { inset, settle } = await renderIn(true, mac);
      expect(inset()).toBe(true);

      isFullscreen.mockResolvedValue(true);
      onResized.mock.calls[0][0]();
      await settle();
      expect(inset()).toBe(false);

      isFullscreen.mockResolvedValue(false);
      onResized.mock.calls[0][0]();
      await settle();
      expect(inset()).toBe(true);
    });

    it("keeps its default when the window can't tell if it is fullscreen", async () => {
      isFullscreen.mockRejectedValue(new Error("unavailable"));
      const { inset } = await renderIn(true, mac);
      expect(inset()).toBe(false);
    });

    it("stops listening for resizes when the bar goes away", async () => {
      const { fixture } = await renderIn(true, mac);
      expect(unlisten).not.toHaveBeenCalled();
      fixture.destroy();
      expect(unlisten).toHaveBeenCalledOnce();
    });

    it("stops listening right away if the bar went away while registering", async () => {
      let registered!: (stop: () => void) => void;
      onResized.mockReturnValue(new Promise((resolve) => (registered = resolve)));
      const { fixture, settle } = await renderIn(true, mac);
      fixture.destroy();
      registered(unlisten);
      await settle();
      expect(unlisten).toHaveBeenCalledOnce();
    });

    it("survives a window that can't report resizes", async () => {
      onResized.mockRejectedValue(new Error("unavailable"));
      const { inset, fixture } = await renderIn(true, mac);
      expect(inset()).toBe(true);
      expect(() => fixture.destroy()).not.toThrow();
      expect(unlisten).not.toHaveBeenCalled();
    });
  });
});
