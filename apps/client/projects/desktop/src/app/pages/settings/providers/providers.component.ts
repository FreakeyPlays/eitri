import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "app-providers",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./providers.component.html",
  host: { class: "block p-6" },
})
export class ProvidersComponent {}
