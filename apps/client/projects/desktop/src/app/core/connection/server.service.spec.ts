import { TestBed } from "@angular/core/testing";
import { ProjectsError } from "@eitri/contracts/project";
import * as Cause from "effect/Cause";
import * as RpcClientError from "effect/rpc/RpcClientError";
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
  const server = (getServerUrl: () => Promise<string>) => {
    TestBed.configureTestingModule({
      providers: [{ provide: ClientService, useValue: { getServerUrl, selectDirectory: null } }],
    });
    return TestBed.inject(ServerService);
  };

  it("asks the desktop shell again after it could not name the server", async () => {
    const notReady = new Error("not ready");
    const getServerUrl = vi.fn<() => Promise<string>>().mockRejectedValue(notReady);
    const service = server(getServerUrl);

    await expect(service.call("projects.list")).rejects.toThrow("Could not reach the Eitri server");
    await expect(service.call("projects.list")).rejects.toHaveProperty("cause", notReady);
    expect(getServerUrl).toHaveBeenCalledTimes(2);
  });

  describe("over the socket", () => {
    const listing = {
      path: "/home/me",
      directories: [{ name: "git", path: "/home/me/git" }],
      truncated: false,
    };
    const dialed: string[] = [];
    let exit: unknown;

    /** A server that answers every request with `exit`. */
    class FakeWebSocket extends EventTarget {
      readonly readyState = 1;

      constructor(url: string) {
        super();
        dialed.push(url);
      }

      send(frame: string) {
        const { _tag, id } = JSON.parse(frame);
        if (_tag !== "Request") return;
        const data = JSON.stringify({ _tag: "Exit", requestId: id, exit });
        setTimeout(() => this.dispatchEvent(Object.assign(new Event("message"), { data })));
      }

      close() {}
    }

    beforeEach(() => {
      dialed.length = 0;
      vi.stubGlobal("WebSocket", FakeWebSocket);
    });

    afterEach(() => vi.unstubAllGlobals());

    it("answers calls with what the server sent, over one socket at its address", async () => {
      exit = { _tag: "Success", value: listing };
      const service = server(async () => "http://127.0.0.1:4318");

      expect(await service.call("folders.browse", { path: "~" })).toEqual(listing);
      expect(await service.call("folders.browse", {})).toEqual(listing);

      expect(dialed).toEqual(["ws://127.0.0.1:4318/api/rpc"]);
    });

    it("rejects with the server's own sentence when it refuses", async () => {
      exit = {
        _tag: "Failure",
        cause: [
          { _tag: "Fail", error: { _tag: "FoldersError", message: "“/gone” does not exist." } },
        ],
      };
      const service = server(async () => "http://127.0.0.1:4318");

      await expect(service.call("folders.browse", { path: "/gone" })).rejects.toThrow(
        "“/gone” does not exist.",
      );
    });
  });
});
