import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { HlmResizableImports } from "@ui/resizable";
import { injectRouteTrail } from "@shell/route-trail";
import { AppBarComponent } from "./app-bar/app-bar.component";
import { EmptyPanelComponent } from "./empty-panel/empty-panel.component";
import { LayoutService } from "./layout/layout.service";
import { SidebarComponent } from "./sidebar/sidebar.component";

type Split = "right" | "bottom";

/** A split's percentages; a hidden panel keeps size 0 so showing it can animate. */
const split = (open: boolean, ratio: number) =>
  open ? [100 - ratio * 100, ratio * 100] : [100, 0];

/**
 * How long the pointer rests on the collapsed rail before it peeks, and the grace after leaving.
 * After a click on the rail it waits longer, so the user can take in the new page first.
 */
const peekDelay = 350;
const peekDelayAfterClick = 1200;
const unpeekDelay = 150;

/** The sidebar's width in pixels while expanded, and as the collapsed icon rail. */
const sidebarWidth = { open: 240, rail: 42 } as const;

/**
 * The window around every page: app bar, sidebar, and resizable panels.
 * The router fills the main panel; see `app.routes.ts`.
 */
@Component({
  selector: "app-shell",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppBarComponent,
    EmptyPanelComponent,
    HlmResizableImports,
    RouterOutlet,
    SidebarComponent,
  ],
  templateUrl: "./shell.component.html",
  host: {
    class: "flex h-dvh min-h-0 flex-col overflow-hidden bg-muted/40 text-foreground",
    "(document:keydown.escape)": "unpeek()",
  },
})
export class ShellComponent {
  protected readonly layout = inject(LayoutService);
  protected readonly sidebarWidth = sidebarWidth;
  protected readonly right = computed(() =>
    split(this.layout.isOpen("right"), this.layout.shown().rightRatio),
  );
  protected readonly bottom = computed(() =>
    split(this.layout.isOpen("bottom"), this.layout.shown().bottomRatio),
  );
  protected readonly dragging = signal<Split | null>(null);
  private latest: Record<Split, number[]> = { right: [], bottom: [] };
  private peekTimer: ReturnType<typeof setTimeout> | undefined;
  /** Off after a peek closes under the pointer, until it leaves the rail. */
  private peekArmed = true;
  private peekWait = peekDelay;

  constructor() {
    const trail = injectRouteTrail();
    // A new page closes the peek.
    effect(() => {
      trail();
      untracked(() => this.unpeek());
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.peekTimer));
  }

  /** Peeks the collapsed sidebar once the pointer stops moving on it; passing over never opens it. */
  protected rest(event: PointerEvent) {
    clearTimeout(this.peekTimer);
    if (event.pointerType === "touch" || !this.peekArmed) return;
    if (this.layout.isOpen("sidebar") || this.layout.peeking()) return;
    this.peekTimer = setTimeout(() => {
      this.peekWait = peekDelay;
      if (!this.layout.isOpen("sidebar")) this.layout.peeking.set(true);
    }, this.peekWait);
  }

  protected press() {
    clearTimeout(this.peekTimer);
    this.peekWait = peekDelayAfterClick;
  }

  protected leave() {
    clearTimeout(this.peekTimer);
    this.peekArmed = true;
    this.peekWait = peekDelay;
    if (this.layout.peeking()) {
      this.peekTimer = setTimeout(() => this.layout.peeking.set(false), unpeekDelay);
    }
  }

  /** Closes the peek, or cancels one still waiting to open. */
  protected unpeek() {
    clearTimeout(this.peekTimer);
    if (!this.layout.peeking()) return;
    this.peekArmed = false;
    this.layout.peeking.set(false);
  }

  protected remember(split: Split, sizes: number[]) {
    this.latest[split] = sizes;
  }

  /** Keeps the dragged panel's share of its split once the drag ends. */
  protected finishResize(split: Split) {
    this.dragging.set(null);
    const sizes = this.latest[split];
    if (sizes.length !== 2 || !this.layout.isOpen(split)) return;
    this.layout.resize(
      split === "right" ? { rightRatio: sizes[1] / 100 } : { bottomRatio: sizes[1] / 100 },
    );
  }

  protected finishKeyboardResize(split: Split, event: KeyboardEvent) {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      this.finishResize(split);
    }
  }
}
