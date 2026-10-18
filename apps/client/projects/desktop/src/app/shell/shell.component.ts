import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { HlmResizableImports } from "@ui/resizable";
import { AppBarComponent } from "./app-bar/app-bar.component";
import { EmptyPanelComponent } from "./empty-panel/empty-panel.component";
import { LayoutService } from "./layout/layout.service";
import { SidebarComponent } from "./sidebar/sidebar.component";

type Split = "right" | "bottom";

/** A split's percentages; a hidden panel keeps size 0 so showing it can animate. */
const split = (open: boolean, ratio: number) =>
  open ? [100 - ratio * 100, ratio * 100] : [100, 0];

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
  host: { class: "flex h-dvh min-h-0 flex-col overflow-hidden bg-muted/40 text-foreground" },
})
export class ShellComponent {
  protected readonly layout = inject(LayoutService);
  protected readonly right = computed(() =>
    split(this.layout.isOpen("right"), this.layout.shown().rightRatio),
  );
  protected readonly bottom = computed(() =>
    split(this.layout.isOpen("bottom"), this.layout.shown().bottomRatio),
  );
  protected readonly dragging = signal<Split | null>(null);
  private latest: Record<Split, number[]> = { right: [], bottom: [] };

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
