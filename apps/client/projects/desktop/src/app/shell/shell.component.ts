import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { NgComponentOutlet } from "@angular/common";
import { RouterOutlet } from "@angular/router";
import { HlmResizableImports } from "@ui/resizable";
import { AppBarComponent } from "./app-bar/app-bar.component";
import { CommandPaletteComponent } from "./commands/command-palette/command-palette.component";
import { measureLayout } from "./layout/layout";
import { LayoutService, type Panel } from "./layout/layout.service";

/**
 * The window around every page: app bar, resizable panels and command palette.
 * The open page decides what fills the panels; see `pages/page.ts`.
 */
@Component({
  selector: "app-shell",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppBarComponent,
    CommandPaletteComponent,
    HlmResizableImports,
    NgComponentOutlet,
    RouterOutlet,
  ],
  templateUrl: "./shell.component.html",
  host: { class: "flex h-dvh min-h-0 flex-col overflow-hidden bg-muted/40 text-foreground" },
})
export class ShellComponent {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly layout = inject(LayoutService);
  private readonly panels = viewChild.required<ElementRef<HTMLElement>>("panels");
  private readonly size = signal({ width: 1200, height: 750 });
  protected readonly dimensions = computed(() =>
    measureLayout(this.layout.shown(), this.size().width, this.size().height),
  );
  protected readonly dragging = signal<Panel | null>(null);
  private latest: Record<Panel, number[]> = { sidebar: [], right: [], bottom: [] };

  constructor() {
    afterNextRender(() => {
      const element = this.panels().nativeElement;
      const measure = () => {
        const { width, height } = element.getBoundingClientRect();
        if (width > 0 && height > 0) this.size.set({ width, height });
      };
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected remember(split: Panel, sizes: number[]) {
    this.latest[split] = sizes;
  }

  /** Converts the dragged split back to pixels or a ratio, so sizes survive window resizes. */
  protected finishResize(split: Panel) {
    this.dragging.set(null);
    const sizes = this.latest[split];
    if (sizes.length !== 2) return;
    const dimensions = this.dimensions();
    if (split === "sidebar" && this.layout.isOpen("sidebar")) {
      this.layout.resize({ sidebarWidth: (sizes[0] * dimensions.outerSpace) / 100 });
    } else if (split === "right" && this.layout.isOpen("right")) {
      this.layout.resize({ rightWidth: (sizes[1] * dimensions.innerSpace) / 100 });
    } else if (split === "bottom" && this.layout.isOpen("bottom")) {
      this.layout.resize({ bottomRatio: sizes[1] / 100 });
    }
  }

  protected finishKeyboardResize(split: Panel, event: KeyboardEvent) {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      this.finishResize(split);
    }
  }
}
