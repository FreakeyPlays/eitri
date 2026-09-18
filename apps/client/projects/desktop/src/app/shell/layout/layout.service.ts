import { computed, DestroyRef, inject, Service, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { filter, map } from "rxjs";
import { activePage } from "@pages/page";
import { defaultLayout, type Layout, LAYOUT_STORAGE_KEY, restoreLayout } from "./layout";

export type Panel = "sidebar" | "right" | "bottom";

const visibility = {
  sidebar: "sidebarExpanded",
  right: "rightVisible",
  bottom: "bottomVisible",
} as const;

/**
 * The open page and how the user arranged the panels around it.
 * Toggle panels here; the shell, app bar and commands all read the same state.
 */
@Service()
export class LayoutService {
  private readonly router = inject(Router);
  private readonly preferences = signal(load());
  private animationTimer: ReturnType<typeof setTimeout> | undefined;

  /** Undefined until the first navigation completes. */
  readonly page = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => activePage(this.router)),
    ),
  );

  /** The layout on screen: panels the page leaves out stay closed without forgetting the user's choice. */
  readonly shown = computed<Layout>(() => {
    const preferences = this.preferences();
    return {
      ...preferences,
      rightVisible: this.has("right") && preferences.rightVisible,
      bottomVisible: this.has("bottom") && preferences.bottomVisible,
    };
  });

  /** True for a moment after a toggle: toggles animate, while drags and restored layouts stay instant. */
  readonly animating = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.animationTimer));
  }

  /** Whether the open page has this panel. */
  has(panel: Panel) {
    return panel === "sidebar" || !!this.page()?.[panel];
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
    this.save();
  }

  /** Remembers sizes after the user finished resizing, never on every frame of a drag. */
  resize(sizes: Partial<Pick<Layout, "sidebarWidth" | "rightWidth" | "bottomRatio">>) {
    this.preferences.update((current) => ({ ...current, ...sizes }));
    this.save();
  }

  private save() {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(this.preferences()));
    } catch {
      /* Layout remains usable without persistence. */
    }
  }
}

function load() {
  try {
    return restoreLayout(localStorage.getItem(LAYOUT_STORAGE_KEY));
  } catch {
    /* Storage can be unavailable in restricted webviews. */
    return { ...defaultLayout };
  }
}
