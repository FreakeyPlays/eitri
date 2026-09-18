/** Changing this key forgets every saved layout. */
export const LAYOUT_STORAGE_KEY = "eitri.workspace-layout.v1";

/** How the user arranged the shell: which panels are open and how large they are. */
export const defaultLayout = {
  sidebarExpanded: true,
  rightVisible: false,
  bottomVisible: false,
  sidebarWidth: 240,
  rightWidth: 300,
  bottomRatio: 0.3,
};

export type Layout = typeof defaultLayout;

export function restoreLayout(value: string | null): Layout {
  try {
    const parsed: unknown = JSON.parse(value ?? "null");
    if (!parsed || typeof parsed !== "object") return { ...defaultLayout };
    const values = parsed as Record<string, unknown>;
    const result = { ...defaultLayout };
    for (const key of ["sidebarExpanded", "rightVisible", "bottomVisible"] as const) {
      if (typeof values[key] === "boolean") result[key] = values[key];
    }
    for (const key of ["sidebarWidth", "rightWidth", "bottomRatio"] as const) {
      if (typeof values[key] === "number" && Number.isFinite(values[key])) {
        result[key] = values[key];
      }
    }
    result.sidebarWidth = clamp(result.sidebarWidth, 180, 360);
    result.rightWidth = Math.max(0, result.rightWidth);
    result.bottomRatio = clamp(result.bottomRatio, PANEL_MIN_RATIO, 1 - PANEL_MIN_RATIO);
    return result;
  } catch {
    return { ...defaultLayout };
  }
}

/** Main, right and terminal panels never shrink below this share of their split. */
const PANEL_MIN_RATIO = 0.2;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Translate remembered sizes into feasible splits, reserving space for the main panel.
 * Hidden panels stay in the split at size 0 so showing and hiding can animate. */
export function measureLayout(layout: Layout, width: number, height: number) {
  const outerSpace = Math.max(1, width - 8);
  const sidebarMax = Math.min(360, outerSpace * 0.4);
  const sidebarMin = Math.min(180, sidebarMax);
  const sidebarWidth = layout.sidebarExpanded
    ? clamp(layout.sidebarWidth, sidebarMin, sidebarMax)
    : Math.min(42, outerSpace * 0.4);
  const innerSpace = Math.max(1, outerSpace - sidebarWidth - (layout.rightVisible ? 8 : 0));
  const rightMin = innerSpace * PANEL_MIN_RATIO;
  const rightMax = innerSpace - rightMin;
  const rightWidth = clamp(layout.rightWidth, rightMin, rightMax);
  const verticalSpace = Math.max(1, height - (layout.bottomVisible ? 8 : 0));
  const bottomMin = verticalSpace * PANEL_MIN_RATIO;
  const bottomMax = verticalSpace - bottomMin;
  const bottomHeight = clamp(layout.bottomRatio * verticalSpace, bottomMin, bottomMax);
  const sidebarPercent = (sidebarWidth / outerSpace) * 100;
  const rightPercent = (rightWidth / innerSpace) * 100;
  const bottomPercent = (bottomHeight / verticalSpace) * 100;
  return {
    outerSpace,
    innerSpace,
    verticalSpace,
    sidebar: [sidebarPercent, 100 - sidebarPercent],
    right: layout.rightVisible ? [100 - rightPercent, rightPercent] : [100, 0],
    bottom: layout.bottomVisible ? [100 - bottomPercent, bottomPercent] : [100, 0],
    sidebarMin: layout.sidebarExpanded ? (sidebarMin / outerSpace) * 100 : sidebarPercent,
    sidebarMax: layout.sidebarExpanded ? (sidebarMax / outerSpace) * 100 : sidebarPercent,
    rightMin: layout.rightVisible ? (rightMin / innerSpace) * 100 : 0,
    rightMax: layout.rightVisible ? (rightMax / innerSpace) * 100 : 0,
    bottomMin: layout.bottomVisible ? (bottomMin / verticalSpace) * 100 : 0,
    bottomMax: layout.bottomVisible ? (bottomMax / verticalSpace) * 100 : 0,
  };
}
