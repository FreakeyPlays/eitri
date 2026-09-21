import { ChangeDetectionStrategy, Component, computed, inject, output } from "@angular/core";
import { HlmButton } from "@ui/button";
import { HlmCommandImports } from "@ui/command";
import { HlmInput } from "@ui/input";
import { XIcon } from "ng-animated-icons";
import { ProjectService } from "@core/projects/project.service";

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
  imports: [HlmButton, HlmCommandImports, HlmInput, XIcon],
  templateUrl: "./project-menu.component.html",
  host: { class: "block" },
})
export class ProjectMenuComponent {
  readonly chosen = output<void>();
  protected readonly projects = inject(ProjectService);

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

  protected async chooseAll() {
    if (await this.projects.openAll()) this.chosen.emit();
  }

  /** Forgets one entry without leaving the dropdown, and never touches the folder. */
  protected forget(path: string) {
    void this.projects.forget(path);
  }

  /** Desktop only: the platform names the folder, then it opens like any other. */
  protected async browse() {
    const picked = await this.projects.browse();
    if (picked !== null) await this.choose(picked);
  }

  /** The browser has no folder picker, so a path on the backend's machine does. */
  protected submitPath(event: Event, path: string) {
    event.preventDefault();
    void this.choose(path.trim());
  }

  protected retry() {
    void this.projects.load();
  }
}
