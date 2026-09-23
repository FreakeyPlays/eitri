export class WebClient {
  getServerUrl(): Promise<string> {
    return Promise.resolve("");
  }

  /** A browser cannot name a folder on the machine the backend runs on. */
  readonly selectDirectory = null;
}
