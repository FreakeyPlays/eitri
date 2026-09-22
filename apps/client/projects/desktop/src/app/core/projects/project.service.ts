import { computed, inject, Service, signal } from "@angular/core";
import { type Project, PROJECTS_ENDPOINT } from "@eitri/contracts/project";
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

/** The shared project collection and this client's locally persisted selection. */
@Service()
export class ProjectService {
  private readonly client = inject(ClientService);
  private readonly known = signal<Known>(NOTHING);
  private readonly pending = signal(false);
  private readonly restoring = signal(false);
  private readonly failure = signal<string | null>(null);
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
  readonly canBrowse = this.client.selectDirectory !== null;

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
    await this.remember(opened.openedProjectId);
    return true;
  }

  /** Selecting every project is local client state and performs no server request. */
  async openAll(): Promise<boolean> {
    if (this.busy()) return false;
    this.failure.set(null);
    this.known.update((known) => ({ ...known, selectedId: null, notice: null }));
    await this.remember(null);
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
    if (selectedId === null) await this.remember(null);
    return true;
  }

  async browse(): Promise<string | null> {
    const picker = this.client.selectDirectory;
    if (!picker) return null;
    try {
      return await picker();
    } catch (error: unknown) {
      this.failure.set(messageOf(error));
      return null;
    }
  }

  private async restore(): Promise<void> {
    this.restoring.set(true);
    try {
      const snapshot = await this.request("GET", undefined, readProjects);
      if (!snapshot) {
        this.started = undefined;
        return;
      }
      this.known.set({ projects: snapshot.projects, selectedId: null, notice: null });

      const selectedId = await this.recall();
      if (!selectedId) return;
      const selected = snapshot.projects.find((project) => project.id === selectedId);
      if (!selected) {
        this.known.update((known) => ({
          ...known,
          notice: "The previously selected project is no longer in the list. Showing all projects.",
        }));
        await this.remember(null);
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
        await this.remember(null);
        return;
      }
      this.known.set({
        projects: opened.projects,
        selectedId: opened.openedProjectId,
        notice: null,
      });
      await this.remember(opened.openedProjectId);
    } finally {
      this.restoring.set(false);
    }
  }

  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    body: unknown,
    read: (reply: unknown) => T,
  ): Promise<T | null> {
    if (this.pending()) return null;
    this.pending.set(true);
    this.failure.set(null);
    try {
      const serverUrl = await this.client.getServerUrl();
      const response = await fetch(
        endpointUrl(serverUrl, PROJECTS_ENDPOINT),
        method === "GET"
          ? {}
          : {
              method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
      ).catch((cause: unknown) => {
        throw new Error(
          "Could not reach the project backend. Restart Eitri or check the server connection.",
          { cause },
        );
      });
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error(
          "Project backend unavailable. Restart Eitri or check that the server is running.",
        );
      }
      const reply: unknown = await response.json();
      if (!response.ok) {
        this.failure.set(readProjectsFailure(reply));
        return null;
      }
      return read(reply);
    } catch (error: unknown) {
      this.failure.set(messageOf(error));
      return null;
    } finally {
      this.pending.set(false);
    }
  }

  private async selectionKey(): Promise<string> {
    const backend = this.canBrowse ? "desktop-local" : globalThis.location?.origin || "web-local";
    return `eitri.project-selection:${backend}`;
  }

  private async recall(): Promise<string | null> {
    try {
      return globalThis.localStorage?.getItem(await this.selectionKey()) ?? null;
    } catch {
      return null;
    }
  }

  private async remember(id: string | null): Promise<void> {
    try {
      const key = await this.selectionKey();
      if (id === null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, id);
    } catch {
      // Local storage is an optimization; a selected project remains usable in memory.
    }
  }
}
