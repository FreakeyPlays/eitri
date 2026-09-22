import { computed, inject, Service, signal } from "@angular/core";
import { FOLDERS_ENDPOINT, type FolderListing } from "@eitri/contracts/folder";
import { type Project, PROJECTS_ENDPOINT } from "@eitri/contracts/project";
import {
  readBrowseFoldersFailure,
  readFolderListing,
  toBrowseFoldersRequest,
} from "@eitri/shared/folder";
import {
  readOpenedProject,
  readProjects,
  readProjectsFailure,
  toForgetProjectRequest,
  toOpenProjectRequest,
  toRenameProjectRequest,
} from "@eitri/shared/project";
import { ClientService } from "@core/client/client.service";
import { endpointUrl } from "@core/client/endpoint";

interface Known {
  readonly projects: readonly Project[];
  readonly selectedId: string | null;
  readonly notice: string | null;
}

const NOTHING: Known = { projects: [], selectedId: null, notice: null };
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Everything about what the user works in: the shared project collection, this
 * client's locally persisted selection, and the two ways to find a folder to open
 * as a project — the platform's picker on desktop, the server's folders on web.
 */
@Service()
export class ProjectService {
  private readonly client = inject(ClientService);
  private readonly known = signal<Known>(NOTHING);
  private readonly pending = signal(false);
  private readonly restoring = signal(false);
  private readonly failure = signal<string | null>(null);
  private readonly listed = signal(false);
  private started: Promise<void> | undefined;

  readonly projects = computed(() => this.known().projects);
  readonly active = computed(() => {
    const { projects, selectedId } = this.known();
    return projects.find((project) => project.id === selectedId) ?? null;
  });
  readonly allSelected = computed(() => this.known().selectedId === null);
  readonly notice = computed(() => this.known().notice);
  readonly error = this.failure.asReadonly();
  readonly busy = computed(() => this.pending() || this.restoring());
  /** False until the collection was read once, so a failed first read can be retried. */
  readonly loaded = this.listed.asReadonly();
  /** Desktop has a native folder picker; web browses the server's folders instead. */
  readonly canPickFolder = this.client.selectDirectory !== null;

  load(): Promise<void> {
    return (this.started ??= this.restore());
  }

  async open(path: string): Promise<boolean> {
    if (this.busy()) return false;
    let request: unknown;
    try {
      request = toOpenProjectRequest(path);
    } catch (error: unknown) {
      this.failure.set(messageOf(error));
      return false;
    }
    const opened = await this.request("POST", request, readOpenedProject);
    if (!opened) return false;
    this.known.set({ projects: opened.projects, selectedId: opened.openedProjectId, notice: null });
    this.remember(opened.openedProjectId);
    return true;
  }

  /** Selecting every project is local client state and performs no server request. */
  openAll(): boolean {
    if (this.busy()) return false;
    this.failure.set(null);
    this.known.update((known) => ({ ...known, selectedId: null, notice: null }));
    this.remember(null);
    return true;
  }

  /** Names one project for every client. The folder on disk is never touched. */
  async rename(id: string, name: string): Promise<boolean> {
    if (this.busy()) return false;
    let request: unknown;
    try {
      request = toRenameProjectRequest(id, name);
    } catch (error: unknown) {
      this.failure.set(messageOf(error));
      return false;
    }
    const snapshot = await this.request("PATCH", request, readProjects);
    if (!snapshot) return false;
    this.known.update((known) => ({ ...known, projects: snapshot.projects, notice: null }));
    return true;
  }

  async forget(id: string): Promise<boolean> {
    if (this.busy()) return false;
    let request: unknown;
    try {
      request = toForgetProjectRequest(id);
    } catch (error: unknown) {
      this.failure.set(messageOf(error));
      return false;
    }
    const snapshot = await this.request("DELETE", request, readProjects);
    if (!snapshot) return false;
    const currentId = this.known().selectedId;
    const selectedId = snapshot.projects.some((project) => project.id === currentId)
      ? currentId
      : null;
    this.known.set({ projects: snapshot.projects, selectedId, notice: null });
    if (selectedId === null) this.remember(null);
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
   * Throws a sentence the folder browser can show; it never touches project state.
   */
  async listFolders(path?: string): Promise<FolderListing> {
    const { path: browsed } = toBrowseFoldersRequest(path);
    const query = browsed === undefined ? "" : `?${new URLSearchParams({ path: browsed })}`;
    const reply = await this.call(FOLDERS_ENDPOINT + query, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!reply.ok) throw new Error(readBrowseFoldersFailure(reply.body));
    return readFolderListing(reply.body);
  }

  private async restore(): Promise<void> {
    this.restoring.set(true);
    try {
      const snapshot = await this.request("GET", undefined, readProjects);
      if (!snapshot) {
        this.started = undefined;
        return;
      }
      this.listed.set(true);
      this.known.set({ projects: snapshot.projects, selectedId: null, notice: null });

      const selectedId = this.recall();
      if (!selectedId) return;
      const selected = snapshot.projects.find((project) => project.id === selectedId);
      if (!selected) {
        this.known.update((known) => ({
          ...known,
          notice: "The previously selected project is no longer in the list. Showing all projects.",
        }));
        this.remember(null);
        return;
      }

      const opened = await this.request(
        "POST",
        toOpenProjectRequest(selected.path),
        readOpenedProject,
      );
      if (!opened) {
        const notice = this.failure();
        this.failure.set(null);
        this.known.update((known) => ({
          ...known,
          notice: notice
            ? `${notice} Showing all projects.`
            : "The previously selected project could not be opened. Showing all projects.",
        }));
        this.remember(null);
        return;
      }
      this.known.set({
        projects: opened.projects,
        selectedId: opened.openedProjectId,
        notice: null,
      });
      this.remember(opened.openedProjectId);
    } finally {
      this.restoring.set(false);
    }
  }

  /** One collection request at a time; its failure becomes `error` for the menu to show. */
  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    body: unknown,
    read: (reply: unknown) => T,
  ): Promise<T | null> {
    if (this.pending()) return null;
    this.pending.set(true);
    this.failure.set(null);
    try {
      const reply = await this.call(
        PROJECTS_ENDPOINT,
        method === "GET"
          ? {}
          : {
              method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
      );
      if (!reply.ok) {
        this.failure.set(readProjectsFailure(reply.body));
        return null;
      }
      return read(reply.body);
    } catch (error: unknown) {
      this.failure.set(messageOf(error));
      return null;
    } finally {
      this.pending.set(false);
    }
  }

  /** Reaches the server and reads its JSON answer, or throws a sentence the user can act on. */
  private async call(endpoint: string, init: RequestInit) {
    const serverUrl = await this.client.getServerUrl();
    const response = await fetch(endpointUrl(serverUrl, endpoint), init).catch((cause: unknown) => {
      throw new Error(
        "Could not reach the Eitri server. Restart Eitri or check the server connection.",
        { cause },
      );
    });
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("Eitri server unavailable. Restart Eitri or check that it is running.");
    }
    const body: unknown = await response.json();
    return { ok: response.ok, body };
  }

  private selectionKey(): string {
    const backend = this.canPickFolder
      ? "desktop-local"
      : globalThis.location?.origin || "web-local";
    return `eitri.project-selection:${backend}`;
  }

  private recall(): string | null {
    try {
      return globalThis.localStorage?.getItem(this.selectionKey()) ?? null;
    } catch {
      return null;
    }
  }

  private remember(id: string | null): void {
    try {
      const key = this.selectionKey();
      if (id === null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, id);
    } catch {
      // Local storage is an optimization; a selected project remains usable in memory.
    }
  }
}
