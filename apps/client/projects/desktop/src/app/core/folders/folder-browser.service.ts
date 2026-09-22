import { inject, Service, signal } from "@angular/core";
import { FOLDERS_ENDPOINT, type FolderListing } from "@eitri/contracts/folder";
import {
  readBrowseFoldersFailure,
  readFolderListing,
  toBrowseFoldersRequest,
} from "@eitri/shared/folder";
import { ClientService } from "@core/client/client.service";
import { endpointUrl } from "@core/client/endpoint";

const sentence = (cause: unknown) =>
  String(cause instanceof Error ? cause.message : cause).split("\n")[0];

/** One folder browser's navigation state. Requests may overlap; only the latest may write it. */
@Service()
export class FolderBrowserService {
  private readonly client = inject(ClientService);
  private request = 0;

  readonly current = signal<FolderListing | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  async navigate(path?: string): Promise<boolean> {
    const request = ++this.request;
    let browse;
    try {
      browse = toBrowseFoldersRequest(path);
    } catch (cause) {
      this.current.set(null);
      this.error.set(sentence(cause));
      this.loading.set(false);
      return false;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      let endpoint = endpointUrl(await this.client.getServerUrl(), FOLDERS_ENDPOINT);
      if (browse.path !== undefined) {
        endpoint += `?${new URLSearchParams({ path: browse.path })}`;
      }
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(15_000) });
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error(
          "Folder browser unavailable. Restart Eitri or check the server connection.",
        );
      }
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(readBrowseFoldersFailure(body));
      const listing = readFolderListing(body);
      if (request !== this.request) return false;
      this.current.set(listing);
      return true;
    } catch (cause) {
      if (request !== this.request) return false;
      this.error.set(
        cause instanceof TypeError
          ? "Could not reach the folder browser. Restart Eitri or check the server connection."
          : sentence(cause),
      );
      return false;
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
}
