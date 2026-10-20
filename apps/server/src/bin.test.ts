import type { Subprocess } from "bun";
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { EitriRpcs } from "@eitri/contracts/rpc";
import { Effect, Exit, type Runtime } from "effect";
import type { RpcGroup } from "effect/rpc";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { type Connection, connect, failure, run } from "./test-utils/server.ts";

/**
 * The executable's own concerns: the startup handshake, and every way the parent can be told to
 * stop. server.test.ts covers the RPC calls and origins in process.
 */
describe("entrypoint configuration", () => {
  const argv = Bun.argv;
  const server = vi.fn(() => Effect.void);
  const main = vi.fn((_effect: unknown, _options: { teardown: Runtime.Teardown }) => {});

  beforeEach(() => {
    vi.resetModules();
    server.mockClear();
    main.mockClear();
    Object.defineProperty(Bun, "argv", { value: ["bun", "bin.ts"] });
    vi.stubEnv("PORT", undefined);
    vi.stubEnv("EITRI_DATA_DIR", "/test-data");
    vi.doMock("./server.ts", () => ({ runServer: server }));
    vi.doMock("@effect/platform-bun/BunRuntime", () => ({ runMain: main }));
    vi.doMock("node:os", () => ({ homedir: () => "/test-home" }));
  });

  afterEach(() => {
    Object.defineProperty(Bun, "argv", { value: argv });
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.doUnmock("./server.ts");
    vi.doUnmock("@effect/platform-bun/BunRuntime");
    vi.doUnmock("node:os");
    vi.resetModules();
  });

  it.each([
    [undefined, 4318],
    ["0", 0],
    ["65535", 65535],
    ["4321", 4321],
  ])("starts the requested port %s", async (input, expected) => {
    vi.stubEnv("PORT", input);
    await import("./bin.ts");
    expect(server).toHaveBeenCalledExactlyOnceWith({
      port: expected,
      sidecar: false,
      dataDir: "/test-data",
    });
    expect(main).toHaveBeenCalledExactlyOnceWith(Effect.void, {
      teardown: expect.any(Function),
    });
  });

  it.each(["-1", "65536", "1.5", "not-a-port"])("refuses invalid PORT %s", async (port) => {
    vi.stubEnv("PORT", port);
    await expect(import("./bin.ts")).rejects.toThrow(
      "PORT must be an integer between 0 and 65535.",
    );
    expect(server).not.toHaveBeenCalled();
    expect(main).not.toHaveBeenCalled();
  });

  it("passes sidecar mode and the development data directory to the server", async () => {
    Object.defineProperty(Bun, "argv", { value: ["bun", "bin.ts", "--sidecar", "--dev"] });
    vi.stubEnv("EITRI_DATA_DIR", undefined);
    await import("./bin.ts");
    expect(server).toHaveBeenCalledExactlyOnceWith({
      port: 4318,
      sidecar: true,
      dataDir: "/test-home/.eitri-dev/userdata",
    });
  });

  it.each([Exit.void, Exit.interrupt()])(
    "exits cleanly after success or interruption",
    async (exit) => {
      await import("./bin.ts");
      const stopped = new Error("process stopped");
      const terminate = vi.spyOn(process, "exit").mockImplementation(() => {
        throw stopped;
      });
      const onExit = vi.fn();
      expect(() => main.mock.calls[0][1].teardown(exit, onExit)).toThrow(stopped);
      expect(terminate).toHaveBeenCalledExactlyOnceWith(0);
      expect(onExit).not.toHaveBeenCalled();
    },
  );

  it("keeps the failing exit code on runtime failure", async () => {
    await import("./bin.ts");
    const terminate = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("must not turn a failure into a clean exit");
    });
    const onExit = vi.fn();
    main.mock.calls[0][1].teardown(Exit.fail(new Error("startup failed")), onExit);
    expect(terminate).not.toHaveBeenCalled();
    expect(onExit).toHaveBeenCalledExactlyOnceWith(1);
  });
});

const modes = [
  { shutdown: "signal", watch: false },
  { shutdown: "stdin", watch: false },
  { shutdown: "eof", watch: false },
  ...(Bun.env["EITRI_SERVER_EXE"] ? [] : [{ shutdown: "signal", watch: true }]),
];

describe.each(modes)("server executable (shutdown: $shutdown, watch: $watch)", (mode) => {
  const { shutdown, watch } = mode;
  const sidecar = shutdown !== "signal";
  let child: Subprocess<"pipe", "pipe", "pipe">;
  let directory: string;
  let url: string;
  let connection: Connection<RpcGroup.Rpcs<typeof EitriRpcs>>;

  beforeAll(async () => {
    // Canonical from the start: a temporary directory is a symlink on macOS, and
    // the backend answers with the resolved path.
    directory = await realpath(await mkdtemp(join(tmpdir(), "eitri-bin-")));
    // A deterministic installed CLI replacement; tests never invoke a real agent.
    await Bun.write(
      join(directory, "codex"),
      `#!/usr/bin/env bun
const prompt = await Bun.stdin.text();
if (prompt === "wait-for-shutdown") {
  await Bun.write("child.pid", String(process.pid));
  setInterval(() => {}, 1000);
} else console.log(prompt);
`,
    );
    await chmod(join(directory, "codex"), 0o755);
    child = Bun.spawn(
      [
        Bun.env["EITRI_SERVER_EXE"] ?? "bun",
        ...(watch ? ["--watch"] : []),
        ...(Bun.env["EITRI_SERVER_EXE"] ? [] : [new URL("./bin.ts", import.meta.url).pathname]),
        ...(sidecar ? ["--sidecar"] : []),
      ],
      {
        cwd: directory,
        env: {
          ...Bun.env,
          PORT: "0",
          // Never the developer's own data: the executable would otherwise
          // resolve the installed app's directory and write to it.
          EITRI_DATA_DIR: join(directory, "userdata"),
          PATH: `${directory}${delimiter}${Bun.env["PATH"]}`,
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    url = await (async () => {
      const reader = child.stdout.pipeThrough(new TextDecoderStream()).getReader();
      let output = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) throw new Error(`Server exited before ready: ${await child.exited}`);
          output += value;
          if (sidecar && output.includes("\n")) {
            const ready = JSON.parse(output.split("\n")[0]) as { url: string };
            return ready.url;
          }
          const match = /listening on (http:\/\/[^\s]+)/.exec(output);
          if (match) return match[1];
        }
      } finally {
        reader.releaseLock();
      }
    })();
    connection = await connect(url, EitriRpcs);
  });

  afterAll(async () => {
    await connection?.close();
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await child.exited;
    }
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("answers an agent request over RPC", async () => {
    const prompt = "--help\n$(literal) ä";
    expect(await run(connection.client["agent.ask"]({ agent: "codex", prompt }))).toBe(prompt);
  });

  it("remembers a project in the data directory it was given", async () => {
    expect(await run(connection.client["projects.open"]({ path: directory }))).toMatchObject({
      openedProjectId: expect.any(String),
      projects: expect.arrayContaining([expect.objectContaining({ path: directory })]),
    });
    // Proof the executable resolved EITRI_DATA_DIR rather than a default location.
    expect(await Bun.file(join(directory, "userdata", "state.sqlite")).exists()).toBe(true);
  });

  it("stops active CLI requests when the parent shuts down", async () => {
    const answer = failure(
      connection.client["agent.ask"]({ agent: "codex", prompt: "wait-for-shutdown" }),
    );
    let pid = 0;
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const file = Bun.file(join(directory, "child.pid"));
      if (await file.exists()) {
        pid = Number(await file.text());
        if (pid > 0) break;
      }
      await Bun.sleep(10);
    }
    expect(pid).toBeGreaterThan(0);
    if (shutdown === "eof") await child.stdin.end();
    else if (shutdown === "stdin") {
      await child.stdin.write("shutdown\n");
      await child.stdin.flush();
    } else child.kill(watch ? "SIGINT" : "SIGTERM");
    // The answer cannot arrive: the connection closes with the server.
    expect(await answer).toMatchObject({ _tag: "RpcClientError" });
    expect(await child.exited).toBe(0);
    expect(() => process.kill(pid, 0)).toThrow();
  });
});
