import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  viewChild,
} from "@angular/core";
import { HlmButton } from "@ui/button";
import { HlmTooltip } from "@ui/tooltip";
import { AnimateIconDirective } from "@shell/animate-icon.directive";
import { LayoutService } from "@shell/layout/layout.service";

/**
 * A sidebar rail entry: icon only while collapsed, icon and label while expanded.
 * Project an 18px icon and bind it to the item's animation:
 * `<app-sidebar-item #item label="Settings"><i-settings size="18" [animate]="item.animate()" /></app-sidebar-item>`
 */
@Component({
  selector: "app-sidebar-item",
  exportAs: "appSidebarItem",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, HlmTooltip, AnimateIconDirective],
  templateUrl: "./sidebar-item.component.html",
  host: { class: "block" },
})
export class SidebarItemComponent {
  readonly label = input.required<string>();
  readonly active = input(false, { transform: booleanAttribute });

  private readonly layout = inject(LayoutService);
  protected readonly expanded = computed(() => this.layout.isOpen("sidebar"));
  private readonly trigger = viewChild.required(AnimateIconDirective);
  readonly animate = computed(() => this.trigger().animate());
}
