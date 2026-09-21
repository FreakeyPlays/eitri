import type { Subprocess } from "bun";
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { AGENT_ENDPOINT } from "@eitri/contracts/agent";
import { PROJECTS_ENDPOINT } from "@eitri/contracts/project";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

/**
 * The executable's own concerns: the startup handshake, and every way the parent can be told to
 * stop. server.test.ts covers routing and CORS in process.
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
  });

  afterAll(async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await child.exited;
    }
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("serves the shared request and answer contract", async () => {
    const prompt = "--help\n$(literal) ä";
    const response = await fetch(new URL(AGENT_ENDPOINT, url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: "codex", prompt }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toBe(prompt);
  });

  it("remembers a project in the data directory it was given", async () => {
    const response = await fetch(new URL(PROJECTS_ENDPOINT, url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: directory }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ activePath: directory, notice: null });
    // Proof the executable resolved EITRI_DATA_DIR rather than a default location.
    expect(await Bun.file(join(directory, "userdata", "projects.json")).exists()).toBe(true);
  });

  it("stops active CLI requests when the parent shuts down", async () => {
    const response = fetch(new URL(AGENT_ENDPOINT, url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: "codex", prompt: "wait-for-shutdown" }),
    });
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
    expect(await (await response).json()).toBe("Agent request cancelled.");
    expect(await child.exited).toBe(0);
    expect(() => process.kill(pid, 0)).toThrow();
  });
});
