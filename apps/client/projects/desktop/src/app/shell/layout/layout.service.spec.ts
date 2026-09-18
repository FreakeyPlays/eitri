import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { routes } from "../../app.routes";
import { newChatPage } from "@pages/new-chat/new-chat.page";
import { defaultLayout } from "./layout";
import { LayoutService } from "./layout.service";

describe("LayoutService", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function open(url: string) {
    const layout = TestBed.inject(LayoutService);
    await TestBed.inject(Router).navigateByUrl(url);
    return layout;
  }

  it("follows the open page and offers only its panels", async () => {
    const layout = await open("/");
    const panels = () =>
      (["sidebar", "right", "bottom"] as const).map((panel) => layout.has(panel));
    expect(layout.page()).toBe(newChatPage);
    expect(panels()).toEqual([true, true, true]);
    await TestBed.inject(Router).navigateByUrl("/settings");
    expect(panels()).toEqual([true, false, false]);
  });

  it("keeps a panel closed on pages without it and reopens it where it exists", async () => {
    const layout = await open("/");
    layout.toggle("right");
    expect(layout.isOpen("right")).toBe(true);
    await TestBed.inject(Router).navigateByUrl("/settings");
    expect(layout.isOpen("right")).toBe(false);
    await TestBed.inject(Router).navigateByUrl("/");
    expect(layout.isOpen("right")).toBe(true);
  });

  it("animates toggles but not resizes", async () => {
    vi.useFakeTimers();
    const layout = await open("/");
    layout.resize({ sidebarWidth: 300 });
    expect(layout.animating()).toBe(false);
    expect(layout.shown().sidebarWidth).toBe(300);
    layout.toggle("sidebar");
    expect(layout.animating()).toBe(true);
    expect(layout.isOpen("sidebar")).toBe(false);
    vi.advanceTimersByTime(200);
    expect(layout.animating()).toBe(false);
  });

  it("stays usable when storage is unavailable", async () => {
    const unavailable = () => {
      throw new Error("denied");
    };
    vi.stubGlobal("localStorage", { getItem: unavailable, setItem: unavailable });
    const layout = await open("/");
    expect(layout.shown()).toEqual(defaultLayout);
    layout.toggle("bottom");
    expect(layout.isOpen("bottom")).toBe(true);
  });
});
