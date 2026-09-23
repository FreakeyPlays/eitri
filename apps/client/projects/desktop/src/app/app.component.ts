import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { isTauri } from "@tauri-apps/api/core";
import { ProjectService } from "@features/projects/project.service";
import { ShellComponent } from "@shell/shell.component";

@Component({
  selector: "app-root",
  imports: [ShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: "<app-shell />",
  host: {
    "[attr.data-desktop]": "desktop ? '' : null",
    "(document:contextmenu)": "onContextMenu($event)",
  },
})
export class AppComponent {
  protected readonly desktop = isTauri();

  constructor() {
    // Restores the project the user left off in; the picker reports any problem.
    void inject(ProjectService).load();
  }

  /** Suppress the webview menu, including overlays; custom menus handle the event first. */
  protected onContextMenu(event: MouseEvent) {
    if (this.desktop) event.preventDefault();
  }
}
