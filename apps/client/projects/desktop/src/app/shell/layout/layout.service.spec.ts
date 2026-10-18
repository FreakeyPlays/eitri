import { TestBed } from "@angular/core/testing";
import { defaultLayout, LayoutService } from "./layout.service";

describe("LayoutService", () => {
  afterEach(() => vi.useRealTimers());

  it("toggles panels independently of each other", () => {
    const layout = TestBed.inject(LayoutService);
    layout.toggle("right");
    expect(layout.isOpen("right")).toBe(true);
    expect(layout.isOpen("bottom")).toBe(false);
    layout.toggle("right");
    expect(layout.isOpen("right")).toBe(false);
  });

  it("animates toggles but not resizes", () => {
    vi.useFakeTimers();
    const layout = TestBed.inject(LayoutService);
    layout.resize({ rightRatio: 0.4 });
    expect(layout.animating()).toBe(false);
    expect(layout.shown().rightRatio).toBe(0.4);
    layout.toggle("sidebar");
    expect(layout.animating()).toBe(true);
    expect(layout.isOpen("sidebar")).toBe(false);
    vi.advanceTimersByTime(200);
    expect(layout.animating()).toBe(false);
  });

  it("shows the sidebar while peeking, and drops the peek on toggle", () => {
    const layout = TestBed.inject(LayoutService);
    layout.toggle("sidebar");
    expect(layout.sidebarShown()).toBe(false);
    layout.peeking.set(true);
    expect(layout.sidebarShown()).toBe(true);
    expect(layout.isOpen("sidebar")).toBe(false);
    layout.toggle("sidebar");
    expect(layout.peeking()).toBe(false);
  });

  it("asks for the project menu once per request, without replaying earlier ones", () => {
    const layout = TestBed.inject(LayoutService);
    layout.showProjectMenu();
    const requests = vi.fn();
    layout.projectMenuRequested.subscribe(requests);
    layout.showProjectMenu();
    expect(requests).toHaveBeenCalledOnce();
  });

  it("starts from the default layout", () => {
    expect(TestBed.inject(LayoutService).shown()).toEqual(defaultLayout);
  });
});
