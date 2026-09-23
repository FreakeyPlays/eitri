import { TestBed } from "@angular/core/testing";
import { ClientService } from "./client.service";
import { TauriClient } from "./tauri-client";
import { WebClient } from "./web-client";

const { isTauri, invoke, open } = vi.hoisted(() => ({
  isTauri: vi.fn<() => boolean>(),
  invoke: vi.fn<(command: string) => Promise<string | null>>(),
  open: vi.fn<(options: unknown) => Promise<string | string[] | null>>(),
}));

vi.mock("@tauri-apps/api/core", () => ({ isTauri, invoke }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open }));

describe("Client", () => {
  beforeEach(() => {
    isTauri.mockReset();
    invoke.mockReset();
    open.mockReset();
    TestBed.configureTestingModule({});
  });

  it("asks the desktop shell where the bundled server listens", async () => {
    isTauri.mockReturnValue(true);
    invoke.mockResolvedValue("http://127.0.0.1:54321/");
    const client = TestBed.inject(ClientService);
    expect(client).toBeInstanceOf(TauriClient);
    expect(await client.getServerUrl()).toBe("http://127.0.0.1:54321/");
    expect(invoke).toHaveBeenCalledExactlyOnceWith("get_server_url");
  });

  it("stays same-origin in the browser instead of invoking Tauri", async () => {
    isTauri.mockReturnValue(false);
    const client = TestBed.inject(ClientService);
    expect(client).toBeInstanceOf(WebClient);
    expect(await client.getServerUrl()).toBe("");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("treats a shell without a server URL as same-origin", async () => {
    isTauri.mockReturnValue(true);
    invoke.mockResolvedValue(null);
    expect(await TestBed.inject(ClientService).getServerUrl()).toBe("");
  });

  it("picks one folder through the desktop dialog", async () => {
    isTauri.mockReturnValue(true);
    open.mockResolvedValue("/git/eitri");

    expect(await TestBed.inject(ClientService).selectDirectory!()).toBe("/git/eitri");
    expect(open).toHaveBeenCalledExactlyOnceWith({ directory: true, multiple: false });
  });

  it.each([null, []])("reports the dismissed dialog (%j) as no choice", async (dismissed) => {
    isTauri.mockReturnValue(true);
    open.mockResolvedValue(dismissed);

    expect(await TestBed.inject(ClientService).selectDirectory!()).toBeNull();
  });

  it("offers no picker in the browser, which cannot browse the server's folders", () => {
    isTauri.mockReturnValue(false);

    // Null the capability, not a picker that resolves null: the UI asks for a path instead.
    expect(TestBed.inject(ClientService).selectDirectory).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it("resolves the server URL once and shares it with later callers", async () => {
    isTauri.mockReturnValue(true);
    invoke.mockResolvedValue("http://127.0.0.1:54321/");
    const client = TestBed.inject(ClientService);
    const [first, second] = await Promise.all([client.getServerUrl(), client.getServerUrl()]);
    expect(first).toBe("http://127.0.0.1:54321/");
    expect(second).toBe(first);
    expect(await client.getServerUrl()).toBe(first);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
