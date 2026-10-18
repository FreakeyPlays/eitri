import { ChangeDetectionStrategy, Component, inject, output, signal } from "@angular/core";
import type { Project } from "@eitri/contracts/project";
import { NgIcon, provideIcons } from "@ng-icons/core";
import { lucideSettings } from "@ng-icons/lucide";
import { HlmButton } from "@ui/button";
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
  imports: [FolderBrowserComponent, HlmButton, NgIcon],
  providers: [provideIcons({ lucideSettings })],
  templateUrl: "./project-menu.component.html",
  host: { "[class]": "browsing() ? 'block w-96' : 'block w-80'" },
})
export class ProjectMenuComponent {
  readonly chosen = output<void>();
  protected readonly projects = inject(ProjectService);
  protected readonly browsing = signal(false);
  private readonly dialog = inject(HlmDialogService);

  protected async choose(path: string) {
    if (await this.projects.open(path)) this.chosen.emit();
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
