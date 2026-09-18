import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  runInInjectionContext,
  signal,
} from "@angular/core";
import { BrnDialogState } from "@spartan-ng/brain/dialog";
import { HlmCommandImports } from "@ui/command";
import { HlmDialogImports } from "@ui/dialog";
import { appCommands } from "../../app.commands";
import type { Command } from "./command";
import { LayoutService } from "@shell/layout/layout.service";

/** Opens with ⌘K or Ctrl+K and lists the app commands, then the open page's commands. */
@Component({
  selector: "app-command-palette",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmCommandImports, HlmDialogImports],
  templateUrl: "./command-palette.component.html",
  host: { "(document:keydown)": "onKeydown($event)" },
})
export class CommandPaletteComponent {
  private readonly injector = inject(Injector);
  private readonly layout = inject(LayoutService);
  protected readonly state = signal<BrnDialogState>("closed");

  /** Commands under their headings, in the order they are defined. */
  protected readonly groups = computed(() => {
    const groups = new Map<string, Command[]>();
    for (const command of [...appCommands, ...(this.layout.page()?.commands ?? [])]) {
      if (command.when && !runInInjectionContext(this.injector, command.when)) continue;
      groups.set(command.group, [...(groups.get(command.group) ?? []), command]);
    }
    return [...groups].map(([label, commands]) => ({ label, commands }));
  });

  protected onKeydown(event: KeyboardEvent) {
    if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    this.state.update((state) => (state === "open" ? "closed" : "open"));
  }

  /** Closes first, so commands that open another dialog don't stack it on the palette. */
  protected run(command: Command) {
    this.state.set("closed");
    runInInjectionContext(this.injector, command.run);
  }
}
