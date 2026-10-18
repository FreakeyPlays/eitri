import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "app-appearance",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./appearance.component.html",
  host: { class: "block p-6" },
})
export class AppearanceComponent {}
