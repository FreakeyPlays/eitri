import { ChangeDetectionStrategy, Component } from "@angular/core";

/** Holds a page's right panel or terminal open until it has real content. */
@Component({
  selector: "app-empty-panel",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: "",
  host: { class: "block p-4" },
})
export class EmptyPanelComponent {}
