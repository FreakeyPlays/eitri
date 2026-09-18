import { ChangeDetectionStrategy, Component } from "@angular/core";
import { HlmButton } from "@ui/button";
import { HlmDialogImports, HlmDialogService } from "@ui/dialog";

@Component({
  selector: "app-add-project-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, HlmDialogImports],
  templateUrl: "./add-project-dialog.component.html",
  host: { class: "contents" },
})
class AddProjectDialogComponent {}

/** Opens the Add Project dialog; its buttons close it. */
export function openAddProjectDialog(dialogs: HlmDialogService) {
  return dialogs.open(AddProjectDialogComponent, { showCloseButton: false });
}
