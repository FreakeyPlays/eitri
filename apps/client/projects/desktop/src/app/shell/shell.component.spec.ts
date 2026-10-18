import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { ProjectService } from "@features/projects/project.service";
import { provideSpartanHlm } from "@ui/utils";
import { routes } from "../app.routes";
import { ShellComponent } from "./shell.component";

const eitri = {
  id: "ca0dcace-34da-4b44-8364-13ce54a32e44",
  path: "/git/eitri",
  name: "eitri",
  lastOpenedAt: "2026-09-21T10:00:00.000Z",
};

describe("ShellComponent", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideSpartanHlm(),
        provideRouter(routes),
        // Project pages render only with a project selected.
        {
          provide: ProjectService,
          useValue: { active: signal(eitri), loaded: signal(true), menuRequested: signal(0) },
        },
      ],
    });
  });

  async function render(url = "/") {
    const fixture = TestBed.createComponent(ShellComponent);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const button = (label: string) => {
      const result = element.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      if (!result) throw new Error(`Missing button: ${label}`);
      return result;
    };
    return { fixture, element, button };
  }

  it.each([{ metaKey: true }, { ctrlKey: true }])(
    "leaves platform shortcuts alone (%j)",
    async (modifier) => {
      const { fixture } = await render();
      const event = new KeyboardEvent("keydown", { key: "k", cancelable: true, ...modifier });

      document.dispatchEvent(event);
      await fixture.whenStable();

      expect(event.defaultPrevented).toBe(false);
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    },
  );

  it("opens the overview with the sidebar and placeholder panels", async () => {
    const { element } = await render();
    expect(TestBed.inject(Router).url).toBe("/overview");
    expect(element.querySelector("#shell-sidebar app-sidebar")).not.toBeNull();
    expect(element.querySelector("#shell-main app-overview")).not.toBeNull();
    expect(element.querySelector("#shell-right app-empty-panel")).not.toBeNull();
    expect(element.querySelector("#shell-bottom app-empty-panel")).not.toBeNull();
  });

  it("starts with the expanded sidebar and main panel, then keeps actions available in the icon rail", async () => {
    const { fixture, element, button } = await render();
    for (const id of ["shell-right", "shell-bottom"]) {
      expect(element.querySelector(`#${id}`)?.getAttribute("data-panel-size")).toBe("0");
    }
    expect(element.querySelector('[aria-label="Sessions"]')).not.toBeNull();
    button("Collapse sidebar").click();
    await fixture.whenStable();
    expect(element.querySelector("#shell-sidebar")).not.toBeNull();
    expect(element.querySelector('[aria-label="Sessions"]')).toBeNull();
    for (const label of ["Overview", "Settings"]) {
      expect(element.querySelector(`a[aria-label="${label}"]`)?.textContent?.trim()).toBe("");
    }
    button("Expand sidebar").click();
    await fixture.whenStable();
    expect(element.querySelector('[aria-label="Sessions"]')).not.toBeNull();
  });

  it("swaps the sidebar on settings while panels stay as the user left them", async () => {
    const { fixture, element, button } = await render();
    button("Show terminal").click();
    await fixture.whenStable();
    element.querySelector<HTMLAnchorElement>('a[aria-label="Settings"]')!.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe("/settings/appearance");
    expect(element.querySelector("#shell-main app-appearance")).not.toBeNull();
    expect(element.querySelector('#shell-sidebar a[aria-label="Back"]')).not.toBeNull();
    expect(
      Number(element.querySelector("#shell-bottom")?.getAttribute("data-panel-size")),
    ).toBeGreaterThan(0);
    element.querySelector<HTMLAnchorElement>('a[aria-label="Back"]')!.click();
    await fixture.whenStable();
    expect(element.querySelector("#shell-main app-overview")).not.toBeNull();
  });

  it("collapses panels and their handles without remounting the main panel", async () => {
    const { fixture, element, button } = await render();
    const main = element.querySelector("main");
    for (const [show, hide, panel] of [
      ["Show right panel", "Hide right panel", "shell-right"],
      ["Show terminal", "Hide terminal", "shell-bottom"],
    ]) {
      const section = element.querySelector<HTMLElement>(`#${panel}`)!;
      const handle = element.querySelector(`hlm-resizable-handle[aria-controls="${panel}"]`)!;
      expect(Number(section.getAttribute("data-panel-size"))).toBe(0);
      expect(section.inert).toBe(true);
      button(show).click();
      await fixture.whenStable();
      expect(Number(section.getAttribute("data-panel-size"))).toBeGreaterThan(0);
      expect(section.inert).toBe(false);
      expect(handle.getAttribute("aria-disabled")).toBe("false");
      expect(button(hide).getAttribute("aria-expanded")).toBe("true");
      expect(element.querySelector("main")).toBe(main);
      button(hide).click();
      await fixture.whenStable();
      expect(element.querySelector(`#${panel}`)).toBe(section);
      expect(Number(section.getAttribute("data-panel-size"))).toBe(0);
      expect(section.inert).toBe(true);
      expect(handle.getAttribute("aria-disabled")).toBe("true");
    }
  });

  it("collapses the fixed-width sidebar to the icon rail and back", async () => {
    const { fixture, element, button } = await render();
    const sidebar = element.querySelector<HTMLElement>("#shell-sidebar")!;
    expect(sidebar.style.width).toBe("240px");
    expect(element.querySelector('hlm-resizable-handle[aria-controls="shell-sidebar"]')).toBeNull();
    button("Collapse sidebar").click();
    await fixture.whenStable();
    expect(sidebar.style.width).toBe("42px");
    button("Expand sidebar").click();
    await fixture.whenStable();
    expect(sidebar.style.width).toBe("240px");
  });

  it("peeks the collapsed sidebar over the main panel while the pointer rests on it", async () => {
    const { fixture, element, button } = await render();
    button("Collapse sidebar").click();
    await fixture.whenStable();
    vi.useFakeTimers();
    try {
      const sidebar = element.querySelector<HTMLElement>("#shell-sidebar")!;
      const rail = sidebar.parentElement!;
      const pointer = (type: string, pointerType = "mouse") =>
        rail.dispatchEvent(new PointerEvent(type, { pointerType }));
      const settle = async (ms: number) => {
        vi.advanceTimersByTime(ms);
        fixture.detectChanges();
      };

      pointer("pointermove");
      await settle(200);
      pointer("pointermove");
      await settle(200);
      expect(sidebar.style.width).toBe("42px");
      await settle(150);
      expect(sidebar.style.width).toBe("240px");
      expect(rail.style.width).toBe("42px");
      expect(element.querySelector('[aria-label="Sessions"]')).not.toBeNull();
      expect(button("Expand sidebar").getAttribute("aria-expanded")).toBe("false");

      pointer("pointerleave");
      await settle(100);
      pointer("pointermove");
      await settle(100);
      expect(sidebar.style.width).toBe("240px");

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      fixture.detectChanges();
      expect(sidebar.style.width).toBe("42px");
      pointer("pointermove");
      await settle(500);
      expect(sidebar.style.width).toBe("42px");

      pointer("pointerleave");
      pointer("pointermove", "touch");
      await settle(500);
      expect(sidebar.style.width).toBe("42px");
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits longer to peek after a click on the rail", async () => {
    const { fixture, element, button } = await render();
    button("Collapse sidebar").click();
    await fixture.whenStable();
    vi.useFakeTimers();
    try {
      const sidebar = element.querySelector<HTMLElement>("#shell-sidebar")!;
      const rail = sidebar.parentElement!;
      const pointer = (type: string) =>
        rail.dispatchEvent(new PointerEvent(type, { pointerType: "mouse" }));

      pointer("pointermove");
      vi.advanceTimersByTime(300);
      pointer("pointerdown");
      vi.advanceTimersByTime(1100);
      fixture.detectChanges();
      expect(sidebar.style.width).toBe("42px");
      pointer("pointermove");
      vi.advanceTimersByTime(1100);
      fixture.detectChanges();
      expect(sidebar.style.width).toBe("42px");
      vi.advanceTimersByTime(100);
      fixture.detectChanges();
      expect(sidebar.style.width).toBe("240px");

      pointer("pointerleave");
      vi.advanceTimersByTime(150);
      pointer("pointermove");
      vi.advanceTimersByTime(350);
      fixture.detectChanges();
      expect(sidebar.style.width).toBe("240px");
    } finally {
      vi.useRealTimers();
    }
  });

  it("resizes the right and bottom independently with nested panels present", async () => {
    const { fixture, element, button } = await render();
    button("Show right panel").click();
    button("Show terminal").click();
    await fixture.whenStable();
    for (const [name, key, id] of [
      ["Resize right panel", "ArrowLeft", "shell-right"],
      ["Resize terminal", "ArrowUp", "shell-bottom"],
    ]) {
      const handle = element.querySelector<HTMLElement>(
        `hlm-resizable-handle[aria-label="${name}"]`,
      )!;
      const panel = element.querySelector<HTMLElement>(`#${id}`)!;
      const before = Number(panel.getAttribute("data-panel-size"));
      handle.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      handle.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
      await fixture.whenStable();
      expect(Number(panel.getAttribute("data-panel-size"))).toBeGreaterThan(before);
    }
  });

  it("resizes by dragging and preserves a complete layout at keyboard extremes", async () => {
    const { fixture, element, button } = await render();
    button("Show right panel").click();
    await fixture.whenStable();
    const handle = element.querySelector<HTMLElement>(
      'hlm-resizable-handle[aria-label="Resize right panel"]',
    )!;
    const group = handle.parentElement!;
    Object.defineProperty(group, "offsetWidth", { value: 1200 });
    const panel = element.querySelector<HTMLElement>("#shell-right")!;
    const before = Number(panel.getAttribute("data-panel-size"));
    handle.dispatchEvent(new MouseEvent("mousedown", { clientX: 900, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 800, bubbles: true }));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    await fixture.whenStable();
    expect(Number(panel.getAttribute("data-panel-size"))).toBeGreaterThan(before);
    expect(handle.getAttribute("data-dragging")).toBe("false");
    for (const key of ["Home", "End", "Enter"]) {
      handle.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      handle.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
      await fixture.whenStable();
      const sizes = Array.from(group.children)
        .filter((child) => child.hasAttribute("data-panel-size"))
        .map((child) => Number(child.getAttribute("data-panel-size")));
      expect(sizes.reduce((a, b) => a + b)).toBeCloseTo(100);
      expect(sizes.every((size) => size > 0)).toBe(true);
    }
  });
});
