import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from "@angular/core";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { HlmButton } from "@ui/button";
import { NgIcon, provideIcons } from "@ng-icons/core";
import {
  lucidePanelLeftClose,
  lucidePanelLeft,
  lucidePanelRightClose,
  lucidePanelRight,
  lucideSquareTerminal,
} from "@ng-icons/lucide";
import { LayoutService } from "@shell/layout/layout.service";
import { BreadcrumbsComponent } from "./breadcrumbs/breadcrumbs.component";

/** The window's title bar: drags the window, shows where the user is, and toggles the panels. */
@Component({
  selector: "app-app-bar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, BreadcrumbsComponent, NgIcon],
  providers: [
    provideIcons({
      lucidePanelLeftClose,
      lucidePanelLeft,
      lucidePanelRightClose,
      lucidePanelRight,
      lucideSquareTerminal,
    }),
  ],
  templateUrl: "./app-bar.component.html",
  host: { class: "contents" },
})
export class AppBarComponent {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly layout = inject(LayoutService);
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
