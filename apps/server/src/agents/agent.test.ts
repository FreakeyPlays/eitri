import { chmod, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import * as BunServices from "@effect/platform-bun/BunServices";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { Effect, Fiber } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import { askAgent, runAgent } from "./agent.ts";

type Run<A, E> = Effect.Effect<A, E, ChildProcessSpawner.ChildProcessSpawner>;

const run = <A, E>(effect: Run<A, E>) =>
  Effect.runPromise(Effect.provide(effect, BunServices.layer));

/** Swaps the channels so assertions can read the message the client would receive. */
const failure = <A, E>(effect: Run<A, E>) => run(Effect.flip(effect));

const bun = (script: string): [string, ...string[]] => [process.execPath, "-e", script];

describe("agent process", () => {
  let directory: string;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "eitri-agent-"));
  });

  afterAll(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("trims surrounding agent output whitespace without changing the answer's formatting", async () => {
    expect(
      await run(
        runAgent(bun('await Bun.write(Bun.stdout, " \\n\\tfirst\\n  second\\t\\n ");'), ""),
      ),
    ).toBe("first\n  second");
  });

  it("drains large agent stdout and stderr concurrently", async () => {
    const output = "ä".repeat(2_000_000);
    expect(
      await run(
        runAgent(
          bun(
            'await Bun.stdin.text(); await Promise.all([Bun.write(Bun.stdout, "ä".repeat(2_000_000)), Bun.write(Bun.stderr, "e".repeat(2_000_000))]);',
          ),
          "hello",
          "10 seconds",
        ),
      ),
    ).toBe(output);
  });

  it.each([
    ["codex", "codex exec --ephemeral --skip-git-repo-check --sandbox read-only --color never -"],
    [
      "claude",
      "claude --print --output-format text --no-session-persistence --tools  --strict-mcp-config",
    ],
  ] as const)("starts %s with its read-only flags and the prompt on stdin", async (agent, line) => {
    const bin = join(directory, "bin");
    await mkdir(bin, { recursive: true });
    // A stand-in CLI that echoes its name, arguments (empty ones kept) and stdin.
    await Bun.write(
      join(bin, agent),
      '#!/bin/sh\nprintf "%s" "$(basename "$0")"; for a in "$@"; do printf " %s" "$a"; done; printf "\\n"; cat\n',
    );
    await chmod(join(bin, agent), 0o755);
    const path = Bun.env["PATH"];
    Bun.env["PATH"] = `${bin}${delimiter}${path}`;
    try {
      expect(await run(askAgent({ agent, prompt: "the prompt" }))).toBe(`${line}\nthe prompt`);
    } finally {
      Bun.env["PATH"] = path;
    }
  });

  it("joins trimmed stderr and stdout in a failure, skipping the empty one", async () => {
    const both = await failure(
      runAgent(["/bin/sh", "-c", "printf '  oops \\n' >&2; printf '  partial \\n'; exit 3"], ""),
    );
    expect(both.message).toBe("Agent exited with 3: oops\npartial");

    const onlyStdout = await failure(
      runAgent(["/bin/sh", "-c", "printf ' only out \\n'; exit 4"], ""),
    );
    expect(onlyStdout.message).toBe("Agent exited with 4: only out");
  });

  it("passes stdin literally and waits for EOF", async () => {
    const prompt = "--help\n$(do-not-execute) `literal` ä";
    expect(
      await run(runAgent(bun("await Bun.write(Bun.stdout, await Bun.stdin.text())"), prompt)),
    ).toBe(prompt);
  });

  it("drains both output streams and reports nonzero exits", async () => {
    const error = await failure(
      runAgent(
        bun('await Bun.stdin.text(); console.error("login required"); process.exitCode = 7;'),
        "hello",
      ),
    );
    expect(error.message).toContain("Agent exited with 7: login required");
  });

  it("reports a missing executable", async () => {
    const error = await failure(runAgent(["/eitri-test-missing-cli"], "hello"));
    expect(error.message).toContain("Could not start agent CLI");
  });

  it("handles repeated early exits while stdin writes are pending", async () => {
    for (let attempt = 0; attempt < 25; attempt++) {
      const error = await failure(
        runAgent(["/bin/sh", "-c", "printf 'login required' >&2; exit 7"], "x".repeat(16_000)),
      );
      expect(error.message).toBe("Agent exited with 7: login required");
    }
    await Bun.sleep(10);
  });

  it("stops and reaps an unresponsive child on timeout", async () => {
    const error = await failure(runAgent(bun("setInterval(() => {}, 1000)"), "", 50));
    expect(error.message).toContain("timed out");
  });

  it("kills an active child when the run is interrupted", async () => {
    const file = join(directory, "child.pid");
    const pid = await run(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          runAgent(
            bun(
              `await Bun.write(${JSON.stringify(file)}, String(process.pid)); setInterval(() => {}, 1000)`,
            ),
            "",
          ),
        );
        const pid = yield* Effect.promise(async () => {
          while (!(await Bun.file(file).exists())) await Bun.sleep(10);
          return Number(await Bun.file(file).text());
        });
        yield* Fiber.interrupt(fiber);
        return pid;
      }),
    );
    expect(pid).toBeGreaterThan(0);
    expect(() => process.kill(pid, 0)).toThrow();
  });
});
