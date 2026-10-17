import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from "@angular/core";
import { HlmButton } from "@ui/button";
import { HlmTooltip } from "@ui/tooltip";
import { LayoutService } from "@shell/layout/layout.service";

/**
 * A sidebar rail entry: icon only while collapsed, icon and label while expanded.
 * Project a decorative 18px icon beside the label.
 */
@Component({
  selector: "app-sidebar-item",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, HlmTooltip],
  templateUrl: "./sidebar-item.component.html",
  host: { class: "block" },
})
export class SidebarItemComponent {
  readonly label = input.required<string>();
  readonly active = input(false, { transform: booleanAttribute });

  private readonly layout = inject(LayoutService);
  protected readonly expanded = computed(() => this.layout.isOpen("sidebar"));
}
