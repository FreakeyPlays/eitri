import * as Schema from "effect/Schema";

/** The Agent CLIs Eitri can drive. */
export const Agent = Schema.Literals(["codex", "claude"]);
export type Agent = typeof Agent.Type;

/** The backend refuses to start a CLI outside this range, counted in UTF-8 bytes. */
export const PROMPT_MAX_BYTES = 16_000;

export const PROMPT_RANGE_MESSAGE = `Enter a prompt between 1 and ${PROMPT_MAX_BYTES.toLocaleString("en-US")} bytes.`;

const PromptSchema = Schema.String.check(
  Schema.makeFilter((prompt) =>
    prompt.trim().length > 0 && new TextEncoder().encode(prompt).length <= PROMPT_MAX_BYTES
      ? undefined
      : PROMPT_RANGE_MESSAGE,
  ),
);

/** One prompt for one CLI run, sent as a JSON HTTP request body. */
export const AgentRequestSchema = Schema.Struct({ agent: Agent, prompt: PromptSchema });

export type AgentRequest = typeof AgentRequestSchema.Type;

/** The CLI's final output. A rejected request answers with a message in the same shape. */
export const AgentAnswerSchema = Schema.String;

/** Route served by `@eitri/server` and proxied by the Angular dev server. */
export const AGENT_ENDPOINT = "/api/agent";
