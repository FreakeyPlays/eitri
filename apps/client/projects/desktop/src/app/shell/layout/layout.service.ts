import { DestroyRef, inject, Service, signal } from "@angular/core";
/** How the user arranged the shell: which panels are open and what share of its split each takes. */
export const defaultLayout = {
  sidebarExpanded: true,
  rightVisible: false,
  bottomVisible: false,
  rightRatio: 0.25,
  bottomRatio: 0.3,
};

type Layout = typeof defaultLayout;

export type Panel = "sidebar" | "right" | "bottom";

const visibility = {
  sidebar: "sidebarExpanded",
  right: "rightVisible",
  bottom: "bottomVisible",
} as const;

/**
 * How the user arranged the panels around the main panel.
 * Toggle panels here; the shell and app bar read the same state.
 */
@Service()
export class LayoutService {
  private readonly preferences = signal({ ...defaultLayout });
  private animationTimer: ReturnType<typeof setTimeout> | undefined;

  /** The layout on screen. */
  readonly shown = this.preferences.asReadonly();

  /** True for a moment after a toggle: toggles animate, while drags stay instant. */
  readonly animating = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.animationTimer));
  }

  isOpen(panel: Panel) {
    return this.shown()[visibility[panel]];
  }

  /** Expands or collapses the sidebar, or shows or hides a panel. */
  toggle(panel: Panel) {
    clearTimeout(this.animationTimer);
    this.animating.set(true);
    this.animationTimer = setTimeout(() => this.animating.set(false), 200);
    const key = visibility[panel];
    this.preferences.update((current) => ({ ...current, [key]: !current[key] }));
  }

  /** Keeps sizes after the user finished resizing, never on every frame of a drag. */
  resize(sizes: Partial<Pick<Layout, "rightRatio" | "bottomRatio">>) {
    this.preferences.update((current) => ({ ...current, ...sizes }));
  }
}
