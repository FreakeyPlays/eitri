import { Service } from "@angular/core";
import { isTauri } from "@tauri-apps/api/core";
import { TauriClient } from "./tauri-client";
import { WebClient } from "./web-client";

@Service({
  factory: () => (isTauri() ? new TauriClient() : new WebClient()),
})
export abstract class ClientService {
  abstract getServerUrl(): Promise<string>;
}
