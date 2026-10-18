import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "app-manage",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./manage.component.html",
  host: { class: "block p-6" },
})
export class ManageComponent {}
