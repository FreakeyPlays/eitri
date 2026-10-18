import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BrnPopoverImports, BrnPopoverTrigger } from "@spartan-ng/brain/popover";
import { HlmButton } from "@ui/button";
import { NgIcon, provideIcons } from "@ng-icons/core";
import { lucideChevronsUpDown } from "@ng-icons/lucide";
import { ProjectService } from "@features/projects/project.service";
import { LayoutService } from "@shell/layout/layout.service";
import { ProjectMenuComponent } from "./project-menu/project-menu.component";

/**
 * Names what the user works in, and drops the project menu open beneath that
 * name, also when another place asks through `LayoutService.showProjectMenu`.
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
  /** Contains the visible name, so voice control finds the button by what it shows. */
  protected readonly label = computed(() => {
    const active = this.projects.active();
    return active ? `Project ${active.name}. Switch project.` : "Select Project";
  });

  constructor() {
    inject(LayoutService)
      .projectMenuRequested.pipe(takeUntilDestroyed())
      .subscribe(() => this.trigger().open());
  }
}
