import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "app-skills",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./skills.component.html",
  host: { class: "block p-6" },
})
export class SkillsComponent {}
