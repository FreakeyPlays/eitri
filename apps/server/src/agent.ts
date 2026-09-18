import { type Agent, AgentRequestSchema } from "@eitri/contracts/agent";
import { Data, type Duration, Effect, type PlatformError, Schema, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";

const commands = {
  codex: [
    "codex",
    "exec",
    "--ephemeral",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--color",
    "never",
    "-",
  ],
  claude: [
    "claude",
    "--print",
    "--output-format",
    "text",
    "--no-session-persistence",
    "--tools",
    "",
    "--strict-mcp-config",
  ],
} satisfies Record<Agent, [string, ...string[]]>;

/** Every agent failure the client is allowed to see; the message is sent back as the answer. */
export class AgentError extends Data.TaggedError("AgentError")<{ message: string }> {}

const decodeRequest = Schema.decodeUnknownEffect(AgentRequestSchema);

const collect = (output: Stream.Stream<Uint8Array, PlatformError.PlatformError>) =>
  Stream.mkString(Stream.decodeText(output));

/** Validates at the backend boundary before starting an installed CLI. */
export const askAgent = (input: unknown) =>
  Effect.gen(function* () {
    const request = yield* decodeRequest(input).pipe(
      Effect.mapError((error) => new AgentError({ message: error.message })),
    );
    return yield* runAgent(commands[request.agent], request.prompt);
  });

/** Passes literal stdin without a shell; interrupting the run kills the child and its group. */
export const runAgent = (
  command: readonly [string, ...string[]],
  prompt: string,
  timeout: Duration.Input = "2 minutes",
) =>
  Effect.gen(function* () {
    const [executable, ...args] = command;
    const child = yield* ChildProcess.make(executable, args, {
      stdin: Stream.succeed(new TextEncoder().encode(prompt)),
    });
    // Draining both pipes alongside the exit keeps a chatty CLI from filling its buffers.
    const [exitCode, stdout, stderr] = yield* Effect.all(
      [child.exitCode, collect(child.stdout), collect(child.stderr)],
      { concurrency: "unbounded" },
    );
    if (exitCode !== 0) {
      return yield* Effect.fail(
        new AgentError({
          message: `Agent exited with ${exitCode}: ${[stderr.trim(), stdout.trim()].filter(Boolean).join("\n")}`,
        }),
      );
    }
    return stdout.trim();
  }).pipe(
    Effect.scoped,
    Effect.catchTag("PlatformError", (error) =>
      Effect.fail(
        new AgentError({
          message: `Could not start agent CLI. Check installation and PATH: ${error.message}`,
        }),
      ),
    ),
    Effect.timeoutOrElse({
      duration: timeout,
      orElse: () =>
        Effect.fail(new AgentError({ message: "Agent timed out; the CLI process was stopped." })),
    }),
  );
