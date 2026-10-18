import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { HlmButton } from "@ui/button";
import { LayoutService } from "@shell/layout/layout.service";

/**
 * A sidebar rail link: icon only while collapsed, icon and label while expanded.
 * Marked as the current page while the router shows its `link`.
 * Project a decorative 18px icon beside the label.
 */
@Component({
  selector: "app-sidebar-item",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, RouterLink, RouterLinkActive],
  templateUrl: "./sidebar-item.component.html",
  host: { class: "block" },
})
export class SidebarItemComponent {
  readonly label = input.required<string>();
  readonly link = input.required<string>();

  private readonly layout = inject(LayoutService);
  protected readonly expanded = computed(() => this.layout.isOpen("sidebar"));
}
