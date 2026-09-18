import { invoke } from "@tauri-apps/api/core";

export class TauriClient {
  private serverUrl: Promise<string> | undefined;

  getServerUrl(): Promise<string> {
    return (this.serverUrl ??= invoke<string | null>("get_server_url")
      .then((url) => url ?? "")
      .catch((error: unknown) => {
        this.serverUrl = undefined;
        throw error;
      }));
  }
}
