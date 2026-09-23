import type { Subprocess } from "bun";
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { EitriRpcs } from "@eitri/contracts/rpc";
import type { RpcGroup } from "effect/unstable/rpc";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { type Connection, connect, failure, run } from "./test-utils/server.ts";

/**
 * The executable's own concerns: the startup handshake, and every way the parent can be told to
 * stop. server.test.ts covers the RPC calls and origins in process.
 */
const modes = [
  { shutdown: "signal", watch: false },
  { shutdown: "stdin", watch: false },
  { shutdown: "eof", watch: false },
  ...(process.env["EITRI_SERVER_EXE"] ? [] : [{ shutdown: "signal", watch: true }]),
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
        process.env["EITRI_SERVER_EXE"] ?? "bun",
        ...(watch ? ["--watch"] : []),
        ...(process.env["EITRI_SERVER_EXE"] ? [] : [new URL("./bin.ts", import.meta.url).pathname]),
        ...(sidecar ? ["--sidecar"] : []),
      ],
      {
        cwd: directory,
        env: {
          ...process.env,
          PORT: "0",
          // Never the developer's own data: the executable would otherwise
          // resolve the installed app's directory and write to it.
          EITRI_DATA_DIR: join(directory, "userdata"),
          PATH: `${directory}${delimiter}${process.env["PATH"]}`,
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
