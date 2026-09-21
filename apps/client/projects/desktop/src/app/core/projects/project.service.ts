import { computed, inject, Service, signal } from "@angular/core";
import { type Project, PROJECTS_ENDPOINT } from "@eitri/contracts/project";
import {
  readProjects,
  readProjectsFailure,
  toForgetProjectRequest,
  toSelectProjectRequest,
} from "@eitri/shared/project";
import { ClientService } from "@core/client/client.service";
import { endpointUrl } from "@core/client/endpoint";

/** What the backend last confirmed. Nothing here reflects a request in flight. */
interface Known {
  readonly projects: readonly Project[];
  readonly activePath: string | null;
  readonly notice: string | null;
}

const NOTHING: Known = { projects: [], activePath: null, notice: null };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * What the user works in — one project or all of them — and the projects they can
 * return to.
 *
 * The backend owns the list, so every client of one Eitri sees the same history
 * and it survives a restart. Only a saved answer reaches these signals: a failed
 * switch leaves the selection alone, and nothing here is optimistic.
 */
@Service()
export class ProjectService {
  private readonly client = inject(ClientService);
  private readonly known = signal<Known>(NOTHING);
  private readonly pending = signal(false);
  private readonly failure = signal<string | null>(null);
  private started: Promise<void> | undefined;

  /** Most recently opened first, as the backend keeps them. */
  readonly projects = computed(() => this.known().projects);

  /** The one selected project, or null while every project is selected. */
  readonly active = computed(() => {
    const { projects, activePath } = this.known();
    return projects.find((project) => project.path === activePath) ?? null;
  });

  /** True when the user works across every project rather than inside one. */
  readonly allSelected = computed(() => this.known().activePath === null);

  /** Why the last project did not open, when the user should know. */
  readonly notice = computed(() => this.known().notice);

  /** The last request that failed; the action can always be tried again. */
  readonly error = this.failure.asReadonly();

  /** True while reading the list or opening a project, so the UI can wait. */
  readonly busy = this.pending.asReadonly();

  /** False in the browser, which cannot browse the backend machine's folders. */
  readonly canBrowse = this.client.selectDirectory !== null;

  /** Reads the remembered projects; the first successful read is shared. */
  load(): Promise<void> {
    return (this.started ??= this.read());
  }

  /** Opens one project, or reports why it cannot. */
  open(path: string): Promise<boolean> {
    return this.send("POST", () => toSelectProjectRequest(path));
  }

  /** Works across every project instead of inside one. */
  openAll(): Promise<boolean> {
    return this.send("POST", () => toSelectProjectRequest(null));
  }

  /** Drops one project from the list; its folder on disk is left alone. */
  forget(path: string): Promise<boolean> {
    return this.send("DELETE", () => toForgetProjectRequest(path));
  }

  /** Asks the platform where a project lives; null when cancelled or unsupported. */
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

  private async read(): Promise<void> {
    // A failed read is not remembered, so the menu can offer to try again.
    if (!(await this.run((endpoint) => fetch(endpoint)))) this.started = undefined;
  }

  /** Validates with the backend's own rule and wording before a request goes out. */
  private send(method: "POST" | "DELETE", body: () => unknown): Promise<boolean> {
    let request: unknown;
    try {
      request = body();
    } catch (error: unknown) {
      this.failure.set(messageOf(error));
      return Promise.resolve(false);
    }
    return this.run((endpoint) =>
      fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }),
    );
  }

  /**
   * One request at a time: the user cannot start a second switch while the first
   * is still being written, so a late answer can never become the open project.
   */
  private async run(send: (endpoint: string) => Promise<Response>): Promise<boolean> {
    if (this.pending()) return false;
    this.pending.set(true);
    this.failure.set(null);
    try {
      const endpoint = endpointUrl(await this.client.getServerUrl(), PROJECTS_ENDPOINT);
      const response = await send(endpoint).catch((cause: unknown) => {
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
      const body: unknown = await response.json();
      if (!response.ok) {
        this.failure.set(readProjectsFailure(body));
        return false;
      }
      this.known.set(readProjects(body));
      return true;
    } catch (error: unknown) {
      this.failure.set(messageOf(error));
      return false;
    } finally {
      this.pending.set(false);
    }
  }
}
