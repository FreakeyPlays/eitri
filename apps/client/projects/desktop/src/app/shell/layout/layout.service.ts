import { computed, DestroyRef, inject, Service, signal } from "@angular/core";
import { Subject } from "rxjs";

/** How the shell starts: which panels are open and what share of its split each takes. */
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
 * How the user arranged the panels around the main panel, for as long as the client runs.
 * Toggle panels here; the shell and app bar read the same state.
 */
@Service()
export class LayoutService {
  private readonly layout = signal({ ...defaultLayout });
  private readonly projectMenuRequests = new Subject<void>();
  private animationTimer: ReturnType<typeof setTimeout> | undefined;

  /** The layout on screen. */
  readonly shown = this.layout.asReadonly();

  /** True for a moment after a toggle: toggles animate, while drags stay instant. */
  readonly animating = signal(false);

  /** The collapsed sidebar shown expanded over the main panel, without changing the layout. */
  readonly peeking = signal(false);

  /** Whether the sidebar looks expanded: kept open, or peeking while collapsed. */
  readonly sidebarShown = computed(() => this.isOpen("sidebar") || this.peeking());

  /** Emits on each `showProjectMenu` call; the title bar's project switcher opens on it. */
  readonly projectMenuRequested = this.projectMenuRequests.asObservable();

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
    if (panel === "sidebar") this.peeking.set(false);
    const key = visibility[panel];
    this.layout.update((current) => ({ ...current, [key]: !current[key] }));
  }

  /** Keeps sizes after the user finished resizing, never on every frame of a drag. */
  resize(sizes: Partial<Pick<Layout, "rightRatio" | "bottomRatio">>) {
    this.layout.update((current) => ({ ...current, ...sizes }));
  }

  /** Opens the title bar's project menu, for places that point the user to it. */
  showProjectMenu() {
    this.projectMenuRequests.next();
  }
}
