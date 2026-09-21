import { inject } from "@angular/core";
import { Router } from "@angular/router";
import type { Command } from "@shell/commands/command";
import { LayoutService } from "@shell/layout/layout.service";

/**
 * Commands the palette offers on every page. Page commands live in each `*.page.ts`.
 *
 * Projects are deliberately absent: the dropdown on the app bar's project name is
 * the one place to switch, and a palette command cannot open a menu anchored to
 * that button without a second way to reach the same list.
 */
export const appCommands: readonly Command[] = [
  {
    group: "Navigation",
    label: "New Chat",
    run: () => inject(Router).navigateByUrl("/"),
  },
  {
    group: "Navigation",
    label: "Settings",
    run: () => inject(Router).navigateByUrl("/settings"),
  },
  {
    group: "Workspace",
    label: "Toggle sidebar",
    run: () => inject(LayoutService).toggle("sidebar"),
  },
  {
    group: "Workspace",
    label: "Toggle terminal",
    when: () => inject(LayoutService).has("bottom"),
    run: () => inject(LayoutService).toggle("bottom"),
  },
  {
    group: "Workspace",
    label: "Toggle right panel",
    when: () => inject(LayoutService).has("right"),
    run: () => inject(LayoutService).toggle("right"),
  },
];
