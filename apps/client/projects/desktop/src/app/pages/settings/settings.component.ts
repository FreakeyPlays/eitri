import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "app-settings",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./settings.component.html",
  host: { class: "block p-6" },
})
export class SettingsComponent {}
