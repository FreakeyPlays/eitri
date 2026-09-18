import { ChangeDetectionStrategy, Component, computed, ElementRef, inject } from "@angular/core";
import { BrnResizableGroup, BrnResizableHandle } from "@spartan-ng/brain/resizable";
import { classes } from "@ui/utils";

@Component({
  selector: "hlm-resizable-handle",
  exportAs: "hlmResizableHandle",
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: BrnResizableHandle, inputs: ["withHandle", "disabled"] }],
  host: {
    "data-slot": "resizable-handle",
    "[attr.aria-valuenow]": "value()",
    "[attr.aria-valuemin]": "minimum()",
    "[attr.aria-valuemax]": "maximum()",
    "(touchstart)": "startTouchResize($event)",
  },
  template: `
    @if (_brnResizableHandle.withHandle()) {
      <div
        class="resize-pill bg-muted-foreground/60 h-8 w-1 shrink-0 rounded-full opacity-0 transition-opacity duration-150 motion-reduce:transition-none"
      ></div>
    }
  `,
})
export class HlmResizableHandle {
  protected readonly _brnResizableHandle = inject(BrnResizableHandle);
  private readonly group = inject(BrnResizableGroup);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly index = computed(() =>
    this.group
      .panels()
      .findIndex(
        (panel) => panel.el.nativeElement === this.element.nativeElement.previousElementSibling,
      ),
  );
  protected readonly value = computed(() => this.group.layout()[this.index()] ?? 0);
  protected readonly minimum = computed(() => this.group.panels()[this.index()]?.minSize() ?? 0);
  protected readonly maximum = computed(() => this.group.panels()[this.index()]?.maxSize() ?? 100);

  protected startTouchResize(event: TouchEvent) {
    if (!this._brnResizableHandle.disabled()) this.group.startResize(this.index(), event);
  }

  constructor() {
    classes(() => [
      "relative flex w-2 shrink-0 touch-none items-center justify-center rounded-full bg-transparent outline-none select-none focus-visible:ring-1 focus-visible:ring-ring data-[panel-group-direction=vertical]:h-2 data-[panel-group-direction=vertical]:w-full [&[data-panel-group-direction=vertical]>div]:h-1 [&[data-panel-group-direction=vertical]>div]:w-8",
      "data-[panel-group-direction=horizontal]:cursor-ew-resize data-[panel-group-direction=vertical]:cursor-ns-resize hover:[&>div]:opacity-100 focus-visible:[&>div]:opacity-100 data-[dragging=true]:[&>div]:opacity-100 aria-disabled:cursor-default aria-disabled:[&>div]:invisible",
    ]);
  }
}
