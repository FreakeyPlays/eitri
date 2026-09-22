import { Service } from "@angular/core";
import { isTauri } from "@tauri-apps/api/core";
import { TauriClient } from "./tauri-client";
import { WebClient } from "./web-client";

@Service({
  factory: () => (isTauri() ? new TauriClient() : new WebClient()),
})
export abstract class ClientService {
  abstract getServerUrl(): Promise<string>;

  /**
   * Opens the platform's folder picker, or null where there is none. A picker
   * resolves to null when the user cancels, so "no picker here" and "the user
   * said no" stay apart: the web client navigates folders through the server.
   */
  abstract readonly selectDirectory: (() => Promise<string | null>) | null;
}
