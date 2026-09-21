import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ProjectService } from "@core/projects/project.service";

@Component({
  selector: "app-new-chat",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./new-chat.component.html",
  host: { class: "flex h-full min-h-48 items-center justify-center p-6" },
})
export class NewChatComponent {
  protected readonly projects = inject(ProjectService);
}
