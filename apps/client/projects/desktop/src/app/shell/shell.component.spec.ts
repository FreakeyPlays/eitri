import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { ProjectService } from "@features/projects/project.service";
import { provideSpartanHlm } from "@ui/utils";
import { routes } from "../app.routes";
import { defaultLayout, LayoutService } from "./layout/layout.service";
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
          useValue: { active: signal(eitri), loaded: signal(true) },
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

  afterEach(() => vi.useRealTimers());

  /** The sidebar's rail under fake timers, with pointer events to drive it. */
  async function renderRail(collapsed = true) {
    const view = await render();
    if (collapsed) {
      view.button("Collapse sidebar").click();
      await view.fixture.whenStable();
    }
    vi.useFakeTimers();
    const rail = view.element.querySelector<HTMLElement>("#shell-sidebar")!.parentElement!;
    const pointer = (type: string) =>
      rail.dispatchEvent(new PointerEvent(type, { pointerType: "mouse" }));
    const advance = (ms: number) => {
      vi.advanceTimersByTime(ms);
      view.fixture.detectChanges();
    };
    return { ...view, layout: TestBed.inject(LayoutService), pointer, advance };
  }

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

  it("cancels a peek that is still waiting on Escape", async () => {
    const { fixture, element, button } = await render();
    button("Collapse sidebar").click();
    await fixture.whenStable();
    vi.useFakeTimers();
    try {
      const sidebar = element.querySelector<HTMLElement>("#shell-sidebar")!;
      sidebar.parentElement!.dispatchEvent(
        new PointerEvent("pointermove", { pointerType: "mouse" }),
      );
      vi.advanceTimersByTime(200);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      vi.advanceTimersByTime(500);
      fixture.detectChanges();
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

  it("does not peek when the pointer leaves the rail before it rests", async () => {
    const { layout, pointer, advance } = await renderRail();
    pointer("pointermove");
    advance(200);
    pointer("pointerleave");
    advance(500);
    expect(layout.peeking()).toBe(false);
  });

  it("closes the peek shortly after the pointer leaves the rail", async () => {
    const { layout, pointer, advance } = await renderRail();
    pointer("pointermove");
    advance(350);
    expect(layout.peeking()).toBe(true);
    pointer("pointerleave");
    advance(100);
    expect(layout.peeking()).toBe(true);
    advance(50);
    expect(layout.peeking()).toBe(false);
  });

  it("peeks again once the pointer has left the rail after Escape", async () => {
    const { layout, pointer, advance } = await renderRail();
    pointer("pointermove");
    advance(350);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    pointer("pointermove");
    advance(500);
    expect(layout.peeking()).toBe(false);
    pointer("pointerleave");
    pointer("pointermove");
    advance(350);
    expect(layout.peeking()).toBe(true);
  });

  it("does not peek over a sidebar that was expanded while the pointer rested", async () => {
    const { layout, pointer, advance } = await renderRail();
    pointer("pointermove");
    advance(200);
    layout.toggle("sidebar");
    advance(200);
    expect(layout.peeking()).toBe(false);
  });

  it("keeps the longer wait after a click until the pointer leaves, even on an open sidebar", async () => {
    const { layout, pointer, advance } = await renderRail(false);
    pointer("pointerdown");
    pointer("pointermove");
    advance(1200);
    layout.toggle("sidebar");
    pointer("pointermove");
    advance(350);
    expect(layout.peeking()).toBe(false);
    advance(850);
    expect(layout.peeking()).toBe(true);
  });

  it("closes the peek on a new page", async () => {
    const { fixture, element, button } = await render();
    button("Collapse sidebar").click();
    await fixture.whenStable();
    const layout = TestBed.inject(LayoutService);
    layout.peeking.set(true);
    fixture.detectChanges();
    expect(element.querySelector<HTMLElement>("#shell-sidebar")!.style.width).toBe("240px");
    await TestBed.inject(Router).navigateByUrl("/settings/appearance");
    await fixture.whenStable();
    expect(layout.peeking()).toBe(false);
    expect(element.querySelector<HTMLElement>("#shell-sidebar")!.style.width).toBe("42px");
  });

  it("stops waiting to peek once the shell is destroyed", async () => {
    const { layout, fixture, pointer } = await renderRail();
    pointer("pointermove");
    fixture.destroy();
    vi.advanceTimersByTime(500);
    expect(layout.peeking()).toBe(false);
  });

  const resizers = {
    right: {
      show: "Show right panel",
      handle: "Resize right panel",
      panel: "shell-right",
      ratio: "rightRatio",
    },
    bottom: {
      show: "Show terminal",
      handle: "Resize terminal",
      panel: "shell-bottom",
      ratio: "bottomRatio",
    },
  } as const;

  /** Shows a panel and returns its handle with what the layout has kept of its share. */
  async function renderResizer(split: keyof typeof resizers) {
    const view = await render();
    const { show, handle, panel, ratio } = resizers[split];
    view.button(show).click();
    await view.fixture.whenStable();
    const layout = TestBed.inject(LayoutService);
    return {
      ...view,
      handle: view.element.querySelector<HTMLElement>(
        `hlm-resizable-handle[aria-label="${handle}"]`,
      )!,
      size: () =>
        Number(view.element.querySelector(`#${panel}`)!.getAttribute("data-panel-size")) / 100,
      kept: () => layout.shown()[ratio],
      fallback: defaultLayout[ratio],
    };
  }

  const key = (type: "keydown" | "keyup", name: string) =>
    new KeyboardEvent(type, { key: name, bubbles: true });

  it.each([
    ["right", "ArrowLeft"],
    ["right", "ArrowRight"],
    ["right", "Home"],
    ["right", "End"],
    ["bottom", "ArrowUp"],
    ["bottom", "ArrowDown"],
    ["bottom", "Home"],
    ["bottom", "End"],
  ] as const)("keeps the %s panel's share after %s", async (split, name) => {
    const { fixture, handle, size, kept, fallback } = await renderResizer(split);
    handle.dispatchEvent(key("keydown", name));
    handle.dispatchEvent(key("keyup", name));
    await fixture.whenStable();
    expect(kept()).not.toBe(fallback);
    expect(kept()).toBeCloseTo(size());
  });

  it("stores the terminal's percentage as a fractional ratio without changing the right panel", async () => {
    const { fixture, handle, size, kept } = await renderResizer("bottom");
    const layout = TestBed.inject(LayoutService);
    const rightRatio = layout.shown().rightRatio;
    const before = size();

    handle.dispatchEvent(key("keydown", "ArrowUp"));
    fixture.detectChanges();
    const resized = size();
    expect(resized).toBeGreaterThan(before);
    expect(resized).toBeLessThan(1);
    handle.dispatchEvent(key("keyup", "ArrowUp"));
    await fixture.whenStable();

    expect(kept()).toBeCloseTo(resized);
    expect(size()).toBeCloseTo(resized);
    expect(layout.shown().rightRatio).toBe(rightRatio);
  });

  it("keeps the share only when a resizing key is released", async () => {
    const { fixture, handle, kept, fallback } = await renderResizer("right");
    handle.dispatchEvent(key("keydown", "ArrowLeft"));
    handle.dispatchEvent(key("keyup", "Shift"));
    await fixture.whenStable();
    expect(kept()).toBe(fallback);
  });

  it("keeps the share when a drag ends without moving", async () => {
    const { fixture, handle, kept, fallback } = await renderResizer("right");
    handle.dispatchEvent(new MouseEvent("mousedown", { clientX: 900, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    await fixture.whenStable();
    expect(kept()).toBe(fallback);
  });

  it("does not keep a share for a panel that was hidden mid-resize", async () => {
    const { fixture, button, handle, kept, fallback } = await renderResizer("right");
    handle.dispatchEvent(key("keydown", "ArrowLeft"));
    button("Hide right panel").click();
    await fixture.whenStable();
    handle.dispatchEvent(key("keyup", "ArrowLeft"));
    expect(kept()).toBe(fallback);
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
