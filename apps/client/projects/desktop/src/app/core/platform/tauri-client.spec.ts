import { invoke } from "@tauri-apps/api/core";
import { TauriClient } from "./tauri-client";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("Tauri client", () => {
  beforeEach(() => vi.mocked(invoke).mockReset());

  it("shares and caches a successful URL lookup", async () => {
    vi.mocked(invoke).mockResolvedValue("http://127.0.0.1:54321");
    const client = new TauriClient();
    const first = client.getServerUrl();
    expect(client.getServerUrl()).toBe(first);
    expect(await first).toBe("http://127.0.0.1:54321");
    expect(await client.getServerUrl()).toBe("http://127.0.0.1:54321");
    expect(invoke).toHaveBeenCalledExactlyOnceWith("get_server_url");
  });

  it("retries after a failed lookup", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("not ready")).mockResolvedValue(null);
    const client = new TauriClient();
    await expect(client.getServerUrl()).rejects.toThrow("not ready");
    expect(await client.getServerUrl()).toBe("");
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
