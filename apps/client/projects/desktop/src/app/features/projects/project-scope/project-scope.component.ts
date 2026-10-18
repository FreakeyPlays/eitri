import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { HlmButton } from "@ui/button";
import { NgIcon, provideIcons } from "@ng-icons/core";
import { lucideFolderOpen } from "@ng-icons/lucide";
import { ProjectService } from "@features/projects/project.service";
import { LayoutService } from "@shell/layout/layout.service";

/**
 * Parent route of every page that works inside a project. Renders the page once a
 * project is selected, and until then a short introduction that opens the project menu.
 * The URL stays put, so choosing a project shows the page the user asked for.
 * See `app.routes.ts`.
 */
@Component({
  selector: "app-project-scope",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, NgIcon, RouterOutlet],
  providers: [provideIcons({ lucideFolderOpen })],
  templateUrl: "./project-scope.component.html",
  host: { class: "contents" },
})
export class ProjectScopeComponent {
  protected readonly projects = inject(ProjectService);
  protected readonly layout = inject(LayoutService);
}
