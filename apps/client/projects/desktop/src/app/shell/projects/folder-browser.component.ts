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
import { HlmButton } from "@ui/button";
import { HlmInput } from "@ui/input";
import { FolderBrowserService } from "@core/folders/folder-browser.service";

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

/** Lets a web client navigate and choose one folder on the server. */
@Component({
  selector: "app-folder-browser",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, HlmInput],
  providers: [FolderBrowserService],
  templateUrl: "./folder-browser.component.html",
  host: { class: "flex min-h-0 flex-col gap-3" },
})
export class FolderBrowserComponent implements OnInit {
  readonly disabled = input(false);
  readonly selected = output<string>();
  readonly cancelled = output<void>();
  protected readonly folders = inject(FolderBrowserService);

  /** The field's text: a folder path, then whatever the user is filtering it by. */
  protected readonly path = signal("");
  private readonly browsed = signal("");

  protected readonly directories = computed(() => {
    const current = this.folders.current();
    if (current === null) return [];
    const filter = filterPart(this.path()).toLocaleLowerCase();
    if (filter === "") return current.directories;
    return current.directories.filter((directory) =>
      directory.name.toLocaleLowerCase().includes(filter),
    );
  });

  ngOnInit() {
    void this.folders.navigate().then(() => {
      // The home folder's real path is only known once its listing arrives.
      const home = this.folders.current()?.path;
      if (home !== undefined && this.path() === "") this.show(home);
    });
  }

  /** Moves into a folder the user picked, leaving the field ready for the next filter. */
  protected open(path: string) {
    this.show(path);
    void this.folders.navigate(path);
  }

  /** Enter moves into the first folder still matching the filter. */
  protected openMatch() {
    const match = this.directories()[0];
    if (match !== undefined && !this.disabled() && !this.folders.loading()) this.open(match.path);
  }

  /** Typing only browses when the folder ahead of the last separator changes. */
  protected editPath(value: string) {
    this.path.set(value);
    const folder = folderPart(value);
    if (folder === "" || folder === this.browsed()) return;
    this.browsed.set(folder);
    void this.folders.navigate(requestPath(folder));
  }

  protected choose() {
    const current = this.folders.current();
    if (
      current !== null &&
      !this.disabled() &&
      !this.folders.loading() &&
      this.folders.error() === null
    ) {
      this.selected.emit(current.path);
    }
  }

  private show(path: string) {
    this.path.set(withSeparator(path));
    this.browsed.set(withSeparator(path));
  }
}
