import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as BunServices from "@effect/platform-bun/BunServices";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { Effect, Fiber } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
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

  it("drains large stdout and stderr concurrently", async () => {
    const output = "ä".repeat(100_000);
    expect(
      await run(
        runAgent(
          bun(
            'await Bun.stdin.text(); await Promise.all([Bun.write(Bun.stdout, "ä".repeat(100_000)), Bun.write(Bun.stderr, "e".repeat(100_000))]);',
          ),
          "hello",
        ),
      ),
    ).toBe(output);
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

  it.each(["", " ", "ä".repeat(8001)])(
    "rejects invalid prompts before spawning",
    async (prompt) => {
      const error = await failure(askAgent({ agent: "codex", prompt }));
      expect(error.message).toContain("Enter a prompt");
    },
  );
});
