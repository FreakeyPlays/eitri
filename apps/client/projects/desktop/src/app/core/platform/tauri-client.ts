import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

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

  /** The desktop folder picker; null while the dialog is dismissed. */
  readonly selectDirectory = async () => {
    const selected = await open({ directory: true, multiple: false });
    return typeof selected === "string" ? selected : null;
  };
}
