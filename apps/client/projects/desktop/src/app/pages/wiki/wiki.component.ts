import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "app-wiki",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./wiki.component.html",
  host: { class: "block p-6" },
})
export class WikiComponent {}
