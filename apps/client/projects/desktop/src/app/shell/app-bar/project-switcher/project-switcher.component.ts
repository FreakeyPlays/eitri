import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { BrnPopoverImports } from "@spartan-ng/brain/popover";
import { HlmButton } from "@ui/button";
import { ChevronsUpDownIcon } from "ng-animated-icons";
import { ProjectService } from "@core/projects/project.service";
import { AnimateIconDirective } from "@shell/animate-icon.directive";
import { ProjectMenuComponent } from "./project-menu.component";

/**
 * Names what the user works in, and drops the project menu open beneath that
 * name. The only way into the menu, so there is one place to switch and
 * nothing to duplicate elsewhere.
 */
@Component({
  selector: "app-project-switcher",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BrnPopoverImports,
    HlmButton,
    AnimateIconDirective,
    ChevronsUpDownIcon,
    ProjectMenuComponent,
  ],
  templateUrl: "./project-switcher.component.html",
  host: { class: "contents" },
})
export class ProjectSwitcherComponent {
  protected readonly projects = inject(ProjectService);

  protected readonly name = computed(() => {
    const active = this.projects.active();
    if (active) return active.name;
    return this.projects.projects().length ? "All projects" : "No project";
  });
  protected readonly label = computed(() => {
    const active = this.projects.active();
    if (active) return `Project ${active.name}. Switch project.`;
    return this.projects.projects().length ? "All projects. Switch project." : "Open a project";
  });
}
