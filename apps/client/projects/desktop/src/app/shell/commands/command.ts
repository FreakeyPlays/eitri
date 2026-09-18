/**
 * An action in the command palette (⌘K). App commands live in `app.commands.ts`,
 * page commands in the page's `*.page.ts`.
 *
 * `run` and `when` are called in an injection context, like functional route guards,
 * so they can `inject()` the services they need.
 */
export interface Command {
  /** Palette heading the command is listed under. */
  group: string;
  label: string;
  run: () => unknown;
  /** Lists the command only while this returns true; the palette follows the signals it reads. */
  when?: () => boolean;
}
