import { type Agent, AgentError, type AgentRequest } from "@eitri/contracts/agent";
import { type Duration, Effect, type PlatformError, Stream } from "effect";
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

const collect = (output: Stream.Stream<Uint8Array, PlatformError.PlatformError>) =>
  Stream.mkString(Stream.decodeText(output));

/** Runs the request's CLI; the RPC layer has already validated the prompt. */
export const askAgent = (request: AgentRequest) =>
  runAgent(commands[request.agent], request.prompt);

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
