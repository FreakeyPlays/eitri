import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "app-preferences",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./preferences.component.html",
  host: { class: "block p-6" },
})
export class PreferencesComponent {}
