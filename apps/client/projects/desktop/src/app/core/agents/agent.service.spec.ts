import { TestBed } from "@angular/core/testing";
import { ClientService } from "@core/client/client.service";
import { AgentService } from "./agent.service";

describe("Agent backend", () => {
  const fetch = vi.fn<typeof globalThis.fetch>();

  beforeEach(() => {
    fetch.mockReset();
    vi.stubGlobal("fetch", fetch);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ClientService,
          useValue: {
            getServerUrl: async () => "",
            selectDirectory: null,
          } satisfies ClientService,
        },
      ],
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each(["", "http://127.0.0.1:54321/"])("uses HTTP with server URL %s", async (serverUrl) => {
    TestBed.overrideProvider(ClientService, {
      useValue: {
        getServerUrl: async () => serverUrl,
        selectDirectory: null,
      } satisfies ClientService,
    });
    fetch.mockImplementation(async () => Response.json("HTTP answer"));
    const backend = TestBed.inject(AgentService);
    const request = { agent: "codex", prompt: "Hello" } as const;
    expect(await backend.ask(request)).toBe("HTTP answer");
    expect(await TestBed.inject(AgentService).ask(request)).toBe("HTTP answer");
    expect(TestBed.inject(AgentService)).toBe(backend);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith(serverUrl ? `${serverUrl}api/agent` : "/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: expect.any(AbortSignal),
    });
  });

  it("rejects CLI failures with an Error", async () => {
    fetch.mockResolvedValue(Response.json("CLI not installed", { status: 400 }));
    await expect(
      TestBed.inject(AgentService).ask({ agent: "codex", prompt: "Hello" }),
    ).rejects.toStrictEqual(new Error("CLI not installed"));
  });

  it("explains a lost server connection and keeps its cause", async () => {
    const cause = new TypeError("Failed to fetch");
    fetch.mockRejectedValue(cause);
    await expect(
      TestBed.inject(AgentService).ask({ agent: "codex", prompt: "Hello" }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("Could not reach the agent backend"),
      cause,
    });
  });

  it.each([
    ["a non-JSON body", () => new Response("proxy error", { status: 502 })],
    ["no content type", () => new Response(null, { status: 502 })],
  ])("explains an unavailable HTTP backend with %s", async (_, response) => {
    fetch.mockResolvedValue(response());
    await expect(
      TestBed.inject(AgentService).ask({ agent: "codex", prompt: "Hello" }),
    ).rejects.toThrow("Agent backend unavailable");
  });

  it("rejects an invalid HTTP response instead of leaking it into the UI", async () => {
    fetch.mockResolvedValue(Response.json({ unexpected: true }));
    await expect(
      TestBed.inject(AgentService).ask({ agent: "codex", prompt: "Hello" }),
    ).rejects.toThrow("Unexpected response");
  });
});
