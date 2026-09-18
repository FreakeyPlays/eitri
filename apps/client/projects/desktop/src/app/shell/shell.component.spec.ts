import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { provideSpartanHlm } from "@ui/utils";
import { routes } from "../app.routes";
import { ShellComponent } from "./shell.component";
import { LAYOUT_STORAGE_KEY } from "./layout/layout";

describe("ShellComponent", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    TestBed.configureTestingModule({ providers: [provideSpartanHlm(), provideRouter(routes)] });
  });

  afterEach(() => vi.unstubAllGlobals());

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

  it("fills each region from the open page", async () => {
    const { element } = await render();
    expect(element.querySelector("#shell-sidebar app-chat-sidebar")).not.toBeNull();
    expect(element.querySelector("#shell-main app-new-chat")).not.toBeNull();
    expect(element.querySelector("#shell-right app-empty-panel")).not.toBeNull();
    expect(element.querySelector("#shell-bottom app-empty-panel")).not.toBeNull();
  });

  it("starts with the expanded sidebar and main panel, then keeps actions available in the icon rail", async () => {
    const { fixture, element, button } = await render();
    for (const id of ["shell-right", "shell-bottom"]) {
      expect(element.querySelector(`#${id}`)?.getAttribute("data-panel-size")).toBe("0");
    }
    expect(element.querySelector('[aria-label="Open chats"]')).not.toBeNull();
    button("Collapse sidebar").click();
    await fixture.whenStable();
    expect(element.querySelector("#shell-sidebar")).not.toBeNull();
    expect(element.querySelector('[aria-label="Open chats"]')).toBeNull();
    for (const label of ["New Chat", "Add Project", "Settings"]) {
      expect(button(label).textContent?.trim()).toBe("");
    }
    button("Expand sidebar").click();
    await fixture.whenStable();
    expect(element.querySelector('[aria-label="Open chats"]')).not.toBeNull();
  });

  it("swaps sidebar and main panel on settings and hides its missing panels without forgetting them", async () => {
    const { fixture, element, button } = await render();
    button("Show right panel").click();
    button("Show terminal").click();
    await fixture.whenStable();
    await TestBed.inject(Router).navigateByUrl("/settings");
    await fixture.whenStable();
    expect(element.querySelector("#shell-main app-settings")).not.toBeNull();
    expect(element.querySelector("#shell-sidebar app-settings-sidebar")).not.toBeNull();
    expect(element.querySelector('[aria-label="Workspace panels"]')).toBeNull();
    for (const id of ["shell-right", "shell-bottom"]) {
      const panel = element.querySelector<HTMLElement>(`#${id}`)!;
      expect(panel.getAttribute("data-panel-size")).toBe("0");
      expect(panel.inert).toBe(true);
      expect(panel.querySelector("app-empty-panel")).toBeNull();
    }
    button("Back to app").click();
    await fixture.whenStable();
    expect(element.querySelector("#shell-main app-new-chat")).not.toBeNull();
    for (const id of ["shell-right", "shell-bottom"]) {
      expect(
        Number(element.querySelector(`#${id}`)?.getAttribute("data-panel-size")),
      ).toBeGreaterThan(0);
    }
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

  it("supports keyboard resizing, restores widths after collapse, and persists visibility", async () => {
    const { fixture, element, button } = await render();
    const handle = element.querySelector<HTMLElement>(
      'hlm-resizable-handle[aria-label="Resize sidebar"]',
    )!;
    const panel = element.querySelector<HTMLElement>("#shell-sidebar")!;
    const before = Number(panel.getAttribute("data-panel-size"));
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    handle.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true }));
    await fixture.whenStable();
    const resized = Number(panel.getAttribute("data-panel-size"));
    expect(resized).toBeGreaterThan(before);
    button("Collapse sidebar").click();
    await fixture.whenStable();
    expect(Number(panel.getAttribute("data-panel-size"))).toBeLessThan(before);
    button("Expand sidebar").click();
    button("Show terminal").click();
    await fixture.whenStable();
    expect(Number(panel.getAttribute("data-panel-size"))).toBeCloseTo(resized);
    expect(JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY)!).bottomVisible).toBe(true);
    fixture.destroy();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideSpartanHlm(), provideRouter(routes)] });
    const restored = await render();
    expect(
      Number(restored.element.querySelector("#shell-bottom")?.getAttribute("data-panel-size")),
    ).toBeGreaterThan(0);
    expect(
      Number(restored.element.querySelector("#shell-sidebar")?.getAttribute("data-panel-size")),
    ).toBeCloseTo(resized);
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
    const { fixture, element } = await render();
    const handle = element.querySelector<HTMLElement>(
      'hlm-resizable-handle[aria-label="Resize sidebar"]',
    )!;
    const group = handle.parentElement!;
    Object.defineProperty(group, "offsetWidth", { value: 1200 });
    const panel = element.querySelector<HTMLElement>("#shell-sidebar")!;
    const before = Number(panel.getAttribute("data-panel-size"));
    handle.dispatchEvent(new MouseEvent("mousedown", { clientX: 240, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 300, bubbles: true }));
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
