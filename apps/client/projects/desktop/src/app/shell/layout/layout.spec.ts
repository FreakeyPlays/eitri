import { defaultLayout, measureLayout, restoreLayout } from "./layout";

describe("layout sizing", () => {
  it("discards invalid saved state and clamps stale sizes", () => {
    expect(restoreLayout("broken")).toEqual(defaultLayout);
    expect(
      restoreLayout(
        JSON.stringify({
          sidebarExpanded: "false",
          rightWidth: -20,
          sidebarWidth: 900,
          bottomRatio: 5,
        }),
      ),
    ).toEqual({ ...defaultLayout, sidebarWidth: 360, rightWidth: 0, bottomRatio: 0.8 });
  });

  it("keeps the collapsed rail at 42px as the window changes", () => {
    for (const width of [600, 1200, 2400]) {
      const size = measureLayout({ ...defaultLayout, sidebarExpanded: false }, width, 800);
      expect((size.sidebar[0] / 100) * size.outerSpace).toBeCloseTo(42);
    }
  });

  it("keeps the main, right and terminal panels at least 20% of their split", () => {
    for (const width of [320, 600, 1200]) {
      const size = measureLayout(
        { ...defaultLayout, rightVisible: true, bottomVisible: true },
        width,
        300,
      );
      for (const split of [size.sidebar, size.right, size.bottom]) {
        expect(split.reduce((a, b) => a + b)).toBeCloseTo(100);
        expect(split.every((value) => value > 0 && value < 100)).toBe(true);
      }
      for (const split of [size.right, size.bottom]) {
        expect(Math.min(...split)).toBeGreaterThanOrEqual(20 - 1e-9);
      }
      expect([size.rightMin, size.bottomMin, 100 - size.rightMax, 100 - size.bottomMax]).toEqual(
        [20, 20, 20, 20].map((value) => expect.closeTo(value)),
      );
    }
    for (const [rightWidth, bottomRatio] of [
      [0, 0],
      [100_000, 1],
    ]) {
      const size = measureLayout(
        {
          ...defaultLayout,
          rightVisible: true,
          bottomVisible: true,
          rightWidth,
          bottomRatio,
        },
        1200,
        800,
      );
      expect(Math.min(...size.right, ...size.bottom)).toBeCloseTo(20);
    }
  });
});
