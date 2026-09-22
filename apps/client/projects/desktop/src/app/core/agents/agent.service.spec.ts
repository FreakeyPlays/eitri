import { TestBed } from "@angular/core/testing";
import { ServerService } from "@core/server/server.service";
import { AgentService } from "./agent.service";

describe("AgentService", () => {
  const call = vi.fn<(tag: string, payload?: unknown) => Promise<unknown>>();

  beforeEach(() => {
    call.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: ServerService, useValue: { call } }] });
  });

  it("asks the server to run the prompt and answers with the CLI's output", async () => {
    call.mockResolvedValue("Hello from the agent");
    const request = { agent: "codex", prompt: "Hello" } as const;

    expect(await TestBed.inject(AgentService).ask(request)).toBe("Hello from the agent");
    expect(call).toHaveBeenCalledExactlyOnceWith("agent.ask", request);
  });

  it("passes the server's sentence on when the CLI fails", async () => {
    call.mockRejectedValue(new Error("Agent exited with 7: login required"));

    await expect(
      TestBed.inject(AgentService).ask({ agent: "claude", prompt: "Hello" }),
    ).rejects.toThrow("Agent exited with 7: login required");
  });
});
