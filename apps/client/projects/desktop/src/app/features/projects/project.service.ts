import { computed, inject, Service, signal } from "@angular/core";
import type { FolderListing } from "@eitri/contracts/folder";
import type { Project } from "@eitri/contracts/project";
import { toBrowseFoldersRequest } from "@eitri/shared/folder";
import {
  toForgetProjectRequest,
  toOpenProjectRequest,
  toRenameProjectRequest,
} from "@eitri/shared/project";
import { ClientService } from "@core/platform/client.service";
import { ServerService } from "@core/connection/server.service";

interface Known {
  readonly projects: readonly Project[];
  readonly selectedId: string | null;
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Everything about what the user works in: the shared project collection, which
 * of them this window shows, and the two ways to find a folder to open as a
 * project — the platform's picker on desktop, the server's folders on web.
 */
@Service()
export class ProjectService {
  private readonly client = inject(ClientService);
  private readonly server = inject(ServerService);
  private readonly known = signal<Known>({ projects: [], selectedId: null });
  private readonly pending = signal(false);
  private readonly failure = signal<string | null>(null);
  private readonly listed = signal(false);
  private started: Promise<void> | undefined;

  readonly projects = computed(() => this.known().projects);
  readonly active = computed(() => {
    const { projects, selectedId } = this.known();
    return projects.find((project) => project.id === selectedId) ?? null;
  });
  readonly allSelected = computed(() => this.known().selectedId === null);
  readonly error = this.failure.asReadonly();
  readonly busy = this.pending.asReadonly();
  /** False until the collection was read once, so a failed first read can be retried. */
  readonly loaded = this.listed.asReadonly();
  /** Desktop has a native folder picker; web browses the server's folders instead. */
  readonly canPickFolder = this.client.selectDirectory !== null;

  /** Reads the collection once; every window starts on all projects. */
  load(): Promise<void> {
    return (this.started ??= this.request(() => this.server.call("projects.list")).then(
      (snapshot) => {
        if (!snapshot) {
          this.started = undefined;
          return;
        }
        this.listed.set(true);
        this.known.set({ projects: snapshot.projects, selectedId: null });
      },
    ));
  }

  async open(path: string): Promise<boolean> {
    const opened = await this.request(() =>
      this.server.call("projects.open", toOpenProjectRequest(path)),
    );
    if (!opened) return false;
    this.known.set({ projects: opened.projects, selectedId: opened.openedProjectId });
    return true;
  }

  /** Selecting every project is local client state and performs no server request. */
  openAll(): boolean {
    if (this.busy()) return false;
    this.failure.set(null);
    this.known.update((known) => ({ ...known, selectedId: null }));
    return true;
  }

  /** Names one project for every client. The folder on disk is never touched. */
  async rename(id: string, name: string): Promise<boolean> {
    const snapshot = await this.request(() =>
      this.server.call("projects.rename", toRenameProjectRequest(id, name)),
    );
    if (!snapshot) return false;
    this.known.update((known) => ({ ...known, projects: snapshot.projects }));
    return true;
  }

  /** Forgetting the selected project widens the scope to all projects. */
  async forget(id: string): Promise<boolean> {
    const snapshot = await this.request(() =>
      this.server.call("projects.forget", toForgetProjectRequest(id)),
    );
    if (!snapshot) return false;
    this.known.update(({ selectedId }) => ({
      projects: snapshot.projects,
      selectedId: snapshot.projects.some((project) => project.id === selectedId)
        ? selectedId
        : null,
    }));
    return true;
  }

  /** Desktop only: resolves to the folder the user picked, or null when they cancelled. */
  async pickFolder(): Promise<string | null> {
    const picker = this.client.selectDirectory;
    if (!picker) return null;
    try {
      return await picker();
    } catch (error: unknown) {
      this.failure.set(messageOf(error));
      return null;
    }
  }

  /**
   * Lists one folder on the server, or its user's home when `path` is omitted.
   * Rejects with a sentence the folder browser can show; it never touches project state.
   */
  async listFolders(path?: string): Promise<FolderListing> {
    return this.server.call("folders.browse", toBrowseFoldersRequest(path));
  }

  /**
   * One collection request at a time; the rest are refused while it runs. `send`
   * builds and validates the request first, so an invalid one never reaches the
   * server; any failure becomes `error` for the menu.
   */
  private async request<T>(send: () => Promise<T>): Promise<T | null> {
    if (this.pending()) return null;
    this.pending.set(true);
    this.failure.set(null);
    try {
      return await send();
    } catch (error: unknown) {
      this.failure.set(messageOf(error));
      return null;
    } finally {
      this.pending.set(false);
    }
  }
}
