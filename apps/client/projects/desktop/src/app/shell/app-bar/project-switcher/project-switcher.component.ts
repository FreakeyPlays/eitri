import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from "@angular/core";
import { BrnPopoverImports, BrnPopoverTrigger } from "@spartan-ng/brain/popover";
import { HlmButton } from "@ui/button";
import { NgIcon, provideIcons } from "@ng-icons/core";
import { lucideChevronsUpDown } from "@ng-icons/lucide";
import { ProjectService } from "@features/projects/project.service";
import { ProjectMenuComponent } from "./project-menu/project-menu.component";

/**
 * Names what the user works in, and drops the project menu open beneath that
 * name, also when another place asks through `ProjectService.showMenu`.
 */
@Component({
  selector: "app-project-switcher",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BrnPopoverImports, HlmButton, NgIcon, ProjectMenuComponent],
  providers: [provideIcons({ lucideChevronsUpDown })],
  templateUrl: "./project-switcher.component.html",
  host: { class: "contents" },
})
export class ProjectSwitcherComponent {
  protected readonly projects = inject(ProjectService);
  private readonly trigger = viewChild.required(BrnPopoverTrigger);

  protected readonly name = computed(() => this.projects.active()?.name ?? "Select Project");
  protected readonly label = computed(() => {
    const active = this.projects.active();
    return active ? `Project ${active.name}. Switch project.` : "Open a project";
  });

  constructor() {
    effect(() => {
      if (this.projects.menuRequested()) untracked(() => this.trigger().open());
    });
  }
}
