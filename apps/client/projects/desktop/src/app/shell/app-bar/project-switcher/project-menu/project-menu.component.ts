import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from "@angular/core";
import type { Project } from "@eitri/contracts/project";
import { NgIcon, provideIcons } from "@ng-icons/core";
import { lucideSettings } from "@ng-icons/lucide";
import { HlmButton } from "@ui/button";
import { HlmCommandImports } from "@ui/command";
import { HlmDialogService } from "@ui/dialog";
import { ProjectService } from "@features/projects/project.service";
import { FolderBrowserComponent } from "../folder-browser/folder-browser.component";
import { ProjectSettingsComponent } from "../project-settings/project-settings.component";

/**
 * What the app bar's project dropdown contains: what the user can work in, and a
 * way to open another folder. The only place a project is chosen.
 *
 * Emits `chosen` once a selection took effect, so the dropdown closes on success
 * and stays open with the reason when the backend refuses. Removing an entry
 * keeps it open, because tidying up is rarely a single action.
 */
@Component({
  selector: "app-project-menu",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FolderBrowserComponent, HlmButton, HlmCommandImports, NgIcon],
  providers: [provideIcons({ lucideSettings })],
  templateUrl: "./project-menu.component.html",
  host: { class: "block" },
})
export class ProjectMenuComponent {
  readonly chosen = output<void>();
  protected readonly projects = inject(ProjectService);
  protected readonly browsing = signal(false);
  private readonly dialog = inject(HlmDialogService);

  /**
   * Working across projects is only a choice once there are several. It stays
   * listed while selected, so the current scope is never hidden from view.
   */
  protected readonly showAllProjects = computed(
    () => this.projects.projects().length > 1 || this.projects.allSelected(),
  );

  protected async choose(path: string) {
    if (await this.projects.open(path)) this.chosen.emit();
  }

  protected chooseAll() {
    if (this.projects.openAll()) this.chosen.emit();
  }

  /**
   * Naming and removal live in a dialog, so the dropdown stays a list of choices.
   * Either outcome keeps the dropdown open: tidying up is rarely a single action.
   */
  protected openSettings(project: Project) {
    this.dialog.open<void, { project: Project }>(ProjectSettingsComponent, {
      context: { project },
      contentClass: "sm:max-w-md",
    });
  }

  /**
   * Desktop asks the platform to name the folder, then opens it like any other.
   * Web has no such picker and browses the server's folders in place instead.
   */
  protected async openFolder() {
    if (!this.projects.canPickFolder) {
      this.browsing.set(true);
      return;
    }
    const picked = await this.projects.pickFolder();
    if (picked !== null) await this.choose(picked);
  }
}
