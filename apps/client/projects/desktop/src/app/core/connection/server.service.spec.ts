import { TestBed } from "@angular/core/testing";
import { ProjectsError } from "@eitri/contracts/project";
import * as Cause from "effect/Cause";
import * as RpcClientError from "effect/unstable/rpc/RpcClientError";
import { ClientService } from "@core/platform/client.service";
import { sentenceOf, ServerService, socketUrl } from "./server.service";

describe("socketUrl", () => {
  it.each([
    {
      serverUrl: "",
      page: "http://localhost:4200/settings",
      expected: "ws://localhost:4200/api/rpc",
    },
    { serverUrl: "", page: "https://eitri.example/", expected: "wss://eitri.example/api/rpc" },
    {
      serverUrl: "http://127.0.0.1:54321/",
      page: "tauri://localhost/",
      expected: "ws://127.0.0.1:54321/api/rpc",
    },
  ])("connects $serverUrl from $page to $expected", ({ serverUrl, page, expected }) => {
    expect(socketUrl(serverUrl, page)).toBe(expected);
  });
});

describe("sentenceOf", () => {
  it("passes on the server's own sentence", () => {
    const refusal = new ProjectsError({ message: "“/git/gone” does not exist." });
    expect(sentenceOf(Cause.fail(refusal))).toBe("“/git/gone” does not exist.");
  });

  it("explains a lost connection", () => {
    const lost = new RpcClientError.RpcClientError({
      reason: new RpcClientError.RpcClientDefect({ message: "socket closed", cause: undefined }),
    });
    expect(sentenceOf(Cause.fail(lost))).toContain("Could not reach the Eitri server");
  });

  it("never shows a server fault's internals", () => {
    expect(sentenceOf(Cause.die(new Error("SQLITE_CORRUPT at 0x1f")))).toBe(
      "Unexpected response from the Eitri server.",
    );
  });
});

describe("ServerService", () => {
  it("asks the desktop shell again after it could not name the server", async () => {
    const getServerUrl = vi.fn<() => Promise<string>>().mockRejectedValue(new Error("not ready"));
    TestBed.configureTestingModule({
      providers: [{ provide: ClientService, useValue: { getServerUrl, selectDirectory: null } }],
    });
    const server = TestBed.inject(ServerService);

    await expect(server.call("projects.list")).rejects.toThrow("Could not reach the Eitri server");
    await expect(server.call("projects.list")).rejects.toThrow("Could not reach the Eitri server");
    expect(getServerUrl).toHaveBeenCalledTimes(2);
  });
});
