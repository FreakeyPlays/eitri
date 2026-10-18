import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from "@angular/core";
import type { FolderListing } from "@eitri/contracts/folder";
import { NgIcon, provideIcons } from "@ng-icons/core";
import { lucideCornerLeftUp, lucideFolder } from "@ng-icons/lucide";
import { HlmButton } from "@ui/button";
import { HlmInput } from "@ui/input";
import { ProjectService } from "@features/projects/project.service";

const HOME = "~/";

const separatorIndex = (value: string) => Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));

/** The folder a typed path points at: everything up to and including its last separator. */
const folderPart = (value: string) => value.slice(0, separatorIndex(value) + 1);

/** What the user typed after the last separator, used to filter the listing. */
const filterPart = (value: string) => value.slice(separatorIndex(value) + 1).trim();

const withSeparator = (path: string) =>
  separatorIndex(path) === path.length - 1 ? path : path + (path.includes("\\") ? "\\" : "/");

/** Drops the trailing separator the field carries, keeping roots like "/", "~" and "C:\" intact. */
const requestPath = (folder: string) => {
  const trimmed = folder.trim().replace(/[\\/]+$/, "");
  return trimmed === "" || trimmed.endsWith(":") ? folder.trim() : trimmed;
};

/** The folder above `folder` as the user would type it, or null at a root or at "~/". */
const parentOf = (folder: string) => {
  const trimmed = folder.replace(/[\\/]+$/, "");
  const index = separatorIndex(trimmed);
  return index < 0 ? null : trimmed.slice(0, index + 1);
};

const sentence = (cause: unknown) =>
  String(cause instanceof Error ? cause.message : cause).split("\n")[0];

/** Prefix matches first, then names that merely contain the filter. Dot folders only on request. */
const matching = (directories: FolderListing["directories"], filter: string) => {
  const needle = filter.toLocaleLowerCase();
  const visible = needle.startsWith(".")
    ? directories
    : directories.filter((directory) => !directory.name.startsWith("."));
  if (needle === "") return visible;
  const lower = (name: string) => name.toLocaleLowerCase();
  return [
    ...visible.filter((directory) => lower(directory.name).startsWith(needle)),
    ...visible.filter(
      (directory) =>
        !lower(directory.name).startsWith(needle) && lower(directory.name).includes(needle),
    ),
  ];
};

/** One line of the list: the way up, or a folder to step into. `folder` is how the field shows it. */
interface Row {
  readonly name: string;
  readonly folder: string;
  readonly up: boolean;
}

/**
 * Lets a web client navigate and choose one folder on the server, keyboard first.
 * The field keeps paths as the user typed them, so home stays "~/"; only the
 * listing knows canonical paths, and only those are ever selected.
 * Listings may arrive out of order; only the newest navigation may write what is shown.
 */
@Component({
  selector: "app-folder-browser",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, HlmInput, NgIcon],
  providers: [provideIcons({ lucideCornerLeftUp, lucideFolder })],
  templateUrl: "./folder-browser.component.html",
  host: { class: "flex min-h-0 flex-col" },
})
export class FolderBrowserComponent {
  readonly disabled = input(false);
  readonly selected = output<string>();
  readonly cancelled = output<void>();
  private readonly projects = inject(ProjectService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>("field");
  private navigation = 0;

  /** The field's text: a folder path, then whatever the user is filtering it by. */
  protected readonly path = signal(HOME);
  private readonly browsed = signal(HOME);
  /**
   * The last listing that arrived and the folder as typed when it was asked for.
   * Kept while the next one loads, so the list never blinks.
   */
  protected readonly shown = signal<{ folder: string; listing: FolderListing } | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);

  protected readonly filter = computed(() => filterPart(this.path()));

  protected readonly directories = computed(() => {
    const shown = this.shown();
    return shown === null ? [] : matching(shown.listing.directories, this.filter());
  });

  protected readonly rows = computed<readonly Row[]>(() => {
    const shown = this.shown();
    if (shown === null || this.error() !== null) return [];
    const parent = parentOf(shown.folder) ?? parentOf(withSeparator(shown.listing.path));
    const up: Row[] =
      parent === null || this.filter() !== "" ? [] : [{ name: "..", folder: parent, up: true }];
    return [
      ...up,
      ...this.directories().map((directory) => ({
        name: directory.name,
        folder: `${shown.folder}${directory.name}/`,
        up: false,
      })),
    ];
  });

  /** A filter highlights its best match; otherwise nothing is, and Enter opens the folder. */
  protected readonly highlighted = linkedSignal(() =>
    this.filter() === "" ? -1 : this.rows().findIndex((row) => !row.up),
  );

  /** What Enter or the button would open: a folder named exactly by the filter, else the one shown. */
  private readonly target = computed(() => {
    const shown = this.shown();
    if (shown === null) return null;
    const exact = shown.listing.directories.find((directory) => directory.name === this.filter());
    return exact
      ? { path: exact.path, label: `${shown.folder}${exact.name}` }
      : { path: shown.listing.path, label: requestPath(shown.folder) };
  });

  protected readonly targetLabel = computed(() => this.target()?.label ?? "");

  protected readonly canChoose = computed(
    () => !this.disabled() && !this.loading() && this.error() === null && this.target() !== null,
  );

  constructor() {
    void this.navigate(HOME);
    afterNextRender(() => this.field().nativeElement.focus());
  }

  /** Steps into a row, leaving the field ready for the next filter. */
  protected open(row: Row) {
    if (this.disabled()) return;
    this.show(row.folder);
    void this.navigate(row.folder);
    this.field().nativeElement.focus();
  }

  /** Typing only browses when the folder ahead of the last separator changes. */
  protected editPath(value: string) {
    this.path.set(value);
    const folder = folderPart(value);
    if (folder === "" || folder === this.browsed()) return;
    this.browsed.set(folder);
    void this.navigate(folder);
  }

  /**
   * Arrows move the highlight. Enter steps into the highlighted row; with none,
   * or with ⌘/Ctrl held, it opens the target.
   */
  protected key(event: KeyboardEvent) {
    if (event.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      this.move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = this.rows()[this.highlighted()];
      if (row !== undefined && !event.metaKey && !event.ctrlKey) this.open(row);
      else this.choose();
    }
  }

  protected choose() {
    const target = this.target();
    if (target !== null && this.canChoose()) this.selected.emit(target.path);
  }

  private move(step: 1 | -1) {
    const next = Math.min(this.rows().length - 1, Math.max(0, this.highlighted() + step));
    this.highlighted.set(next);
    this.host.nativeElement
      .querySelector(`#folder-option-${next}`)
      ?.scrollIntoView({ block: "nearest" });
  }

  private async navigate(folder: string) {
    const navigation = ++this.navigation;
    this.loading.set(true);
    this.error.set(null);
    try {
      const listing = await this.projects.listFolders(requestPath(folder));
      if (navigation !== this.navigation) return;
      this.shown.set({ folder: withSeparator(folder), listing });
    } catch (cause: unknown) {
      if (navigation === this.navigation) this.error.set(sentence(cause));
    } finally {
      if (navigation === this.navigation) this.loading.set(false);
    }
  }

  private show(folder: string) {
    this.path.set(folder);
    this.browsed.set(folder);
  }
}
