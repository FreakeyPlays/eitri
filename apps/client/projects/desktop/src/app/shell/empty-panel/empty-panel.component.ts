import { ChangeDetectionStrategy, Component } from "@angular/core";

/** Fills the right panel and the terminal until they have real content. */
@Component({
  selector: "app-empty-panel",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./empty-panel.component.html",
  host: { class: "block p-4" },
})
export class EmptyPanelComponent {}
