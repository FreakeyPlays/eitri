import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  output,
  signal,
} from "@angular/core";
import type { FolderListing } from "@eitri/contracts/folder";
import { HlmButton } from "@ui/button";
import { HlmInput } from "@ui/input";
import { ProjectService } from "@features/projects/project.service";

const separatorIndex = (value: string) => Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));

/** The folder a typed path points at: everything up to and including its last separator. */
const folderPart = (value: string) => value.slice(0, separatorIndex(value) + 1);

/** What the user typed after the last separator, used to filter the listing. */
const filterPart = (value: string) => value.slice(separatorIndex(value) + 1).trim();

const withSeparator = (path: string) =>
  separatorIndex(path) === path.length - 1 ? path : path + (path.includes("\\") ? "\\" : "/");

/** Drops the trailing separator the field carries, keeping roots like "/" and "C:\" intact. */
const requestPath = (folder: string) => {
  const trimmed = folder.trim().replace(/[\\/]+$/, "");
  return trimmed === "" || trimmed.endsWith(":") ? folder.trim() : trimmed;
};

const sentence = (cause: unknown) =>
  String(cause instanceof Error ? cause.message : cause).split("\n")[0];

/**
 * Lets a web client navigate and choose one folder on the server. Listings may
 * arrive out of order; only the newest navigation may write what is shown.
 */
@Component({
  selector: "app-folder-browser",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, HlmInput],
  templateUrl: "./folder-browser.component.html",
  host: { class: "flex min-h-0 flex-col gap-3" },
})
export class FolderBrowserComponent implements OnInit {
  readonly disabled = input(false);
  readonly selected = output<string>();
  readonly cancelled = output<void>();
  private readonly projects = inject(ProjectService);
  private navigation = 0;

  /** The field's text: a folder path, then whatever the user is filtering it by. */
  protected readonly path = signal("");
  private readonly browsed = signal("");
  /** The last listing that arrived; kept while the next loads, so the list never blinks. */
  protected readonly current = signal<FolderListing | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);

  protected readonly directories = computed(() => {
    const current = this.current();
    if (current === null) return [];
    const filter = filterPart(this.path()).toLocaleLowerCase();
    if (filter === "") return current.directories;
    return current.directories.filter((directory) =>
      directory.name.toLocaleLowerCase().includes(filter),
    );
  });

  protected readonly canChoose = computed(
    () => !this.disabled() && !this.loading() && this.error() === null && this.current() !== null,
  );

  ngOnInit() {
    void this.navigate();
  }

  /** Moves into a folder the user picked, leaving the field ready for the next filter. */
  protected open(path: string) {
    this.show(path);
    void this.navigate(path);
  }

  /** Enter moves into the first folder still matching the filter. */
  protected openMatch() {
    const match = this.directories()[0];
    if (match !== undefined && !this.disabled() && !this.loading()) this.open(match.path);
  }

  /** Typing only browses when the folder ahead of the last separator changes. */
  protected editPath(value: string) {
    this.path.set(value);
    const folder = folderPart(value);
    if (folder === "" || folder === this.browsed()) return;
    this.browsed.set(folder);
    void this.navigate(requestPath(folder));
  }

  protected choose() {
    const current = this.current();
    if (current !== null && this.canChoose()) this.selected.emit(current.path);
  }

  /** Without a path, starts at the server's home, whose real path only its listing knows. */
  private async navigate(path?: string) {
    const navigation = ++this.navigation;
    this.loading.set(true);
    this.error.set(null);
    try {
      const listing = await this.projects.listFolders(path);
      if (navigation !== this.navigation) return;
      this.current.set(listing);
      if (this.path() === "") this.show(listing.path);
    } catch (cause: unknown) {
      if (navigation === this.navigation) this.error.set(sentence(cause));
    } finally {
      if (navigation === this.navigation) this.loading.set(false);
    }
  }

  private show(path: string) {
    this.path.set(withSeparator(path));
    this.browsed.set(withSeparator(path));
  }
}
