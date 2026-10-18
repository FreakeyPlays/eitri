import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ProjectService } from "@features/projects/project.service";

@Component({
  selector: "app-new-session",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./new-session.component.html",
  host: { class: "flex h-full min-h-48 items-center justify-center p-6" },
})
export class NewSessionComponent {
  protected readonly projects = inject(ProjectService);
}
