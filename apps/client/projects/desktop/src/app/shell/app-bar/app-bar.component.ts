import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from "@angular/core";
import { BrnPopoverImports } from "@spartan-ng/brain/popover";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { HlmButton } from "@ui/button";
import { HlmTooltip } from "@ui/tooltip";
import {
  ChevronsUpDownIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  SquareTerminalIcon,
} from "ng-animated-icons";
import { ProjectService } from "@core/projects/project.service";
import { AnimateIconDirective } from "@shell/animate-icon.directive";
import { LayoutService } from "@shell/layout/layout.service";
import { ProjectMenuComponent } from "@shell/projects/project-menu.component";

/**
 * The window's title bar: drags the window, names the open project, and toggles
 * the panels the page has. The project name is the only way into the project
 * dropdown, so there is one place to switch and nothing to duplicate elsewhere.
 */
@Component({
  selector: "app-app-bar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BrnPopoverImports,
    HlmButton,
    HlmTooltip,
    AnimateIconDirective,
    ProjectMenuComponent,
    ChevronsUpDownIcon,
    PanelLeftCloseIcon,
    PanelLeftOpenIcon,
    PanelRightCloseIcon,
    PanelRightOpenIcon,
    SquareTerminalIcon,
  ],
  templateUrl: "./app-bar.component.html",
  host: { class: "contents" },
})
export class AppBarComponent {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly layout = inject(LayoutService);
  protected readonly projects = inject(ProjectService);

  /** What the user works in, named here on every page so it is never in doubt. */
  protected readonly projectName = computed(() => {
    const active = this.projects.active();
    if (active) return active.name;
    return this.projects.projects().length ? "All projects" : "No project";
  });
  protected readonly projectLabel = computed(() => {
    const active = this.projects.active();
    if (active) return `Project ${active.name}. Switch project.`;
    return this.projects.projects().length ? "All projects. Switch project." : "Open a project";
  });
  /** macOS draws its window buttons over the app bar in Tauri, except in fullscreen where they hide. */
  protected readonly windowControlsInset = signal(false);

  constructor() {
    afterNextRender(() => {
      if (isTauri() && navigator.userAgent.includes("Mac")) void this.trackWindowControls();
    });
  }

  private async trackWindowControls() {
    const window = getCurrentWindow();
    const update = async () => this.windowControlsInset.set(!(await window.isFullscreen()));
    await update();
    const unlisten = await window.onResized(update);
    this.destroyRef.onDestroy(unlisten);
  }
}
