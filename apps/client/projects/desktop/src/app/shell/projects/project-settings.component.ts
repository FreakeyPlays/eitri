import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { type Project, PROJECT_NAME_MAX } from "@eitri/contracts/project";
import { BrnDialogRef, injectBrnDialogContext } from "@spartan-ng/brain/dialog";
import { HlmButton } from "@ui/button";
import { HlmDialogDescription, HlmDialogHeader, HlmDialogTitle } from "@ui/dialog";
import { HlmInput } from "@ui/input";
import { ProjectService } from "@core/projects/project.service";

/** What the dialog reports back, so the menu knows whether the project is still there. */
export type ProjectSettingsResult = "renamed" | "removed";

/**
 * Settings for one project: the name Eitri shows for it, and removing it from
 * Eitri. Removal is deliberately last and destructive-styled, and never touches
 * the folder itself.
 */
@Component({
  selector: "app-project-settings",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, HlmDialogDescription, HlmDialogHeader, HlmDialogTitle, HlmInput],
  templateUrl: "./project-settings.component.html",
  host: { class: "flex flex-col gap-4" },
})
export class ProjectSettingsComponent {
  protected readonly maxLength = PROJECT_NAME_MAX;
  protected readonly projects = inject(ProjectService);
  private readonly dialog = inject(BrnDialogRef<ProjectSettingsResult>);
  protected readonly project = injectBrnDialogContext<{ project: Project }>().project;

  protected readonly name = signal(this.project.name);
  protected readonly confirming = signal(false);

  /** What an empty field falls back to, so the hint names it rather than describing it. */
  protected readonly folderName =
    this.project.path.split(/[\\/]/).filter(Boolean).at(-1) ?? this.project.path;

  /** Whatever stands in the field becomes the name; an empty field clears it. */
  protected async save() {
    if (this.projects.busy()) return;
    if (await this.projects.rename(this.project.id, this.name().trim())) {
      this.dialog.close("renamed");
    }
  }

  protected async remove() {
    if (this.projects.busy()) return;
    if (await this.projects.forget(this.project.id)) this.dialog.close("removed");
  }
}
