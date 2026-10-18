import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "app-overview",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./overview.component.html",
  host: { class: "block p-6" },
})
export class OverviewComponent {}
