import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";
import { Agent, AgentRequestSchema, PROMPT_MAX_BYTES, PROMPT_RANGE_MESSAGE } from "./agent.ts";

describe("AgentRequestSchema", () => {
  const decodeRequest = Schema.decodeUnknownSync(AgentRequestSchema);

  it.each(Agent.literals)("accepts a prompt for %s", (agent) => {
    expect(decodeRequest({ agent, prompt: "Hello" })).toEqual({ agent, prompt: "Hello" });
  });

  it.each(["", "   ", "\n\t"])("rejects the blank prompt %j", (prompt) => {
    expect(() => decodeRequest({ agent: "codex", prompt })).toThrow(PROMPT_RANGE_MESSAGE);
  });

  it("measures the limit in UTF-8 bytes, not characters", () => {
    const twoBytesPerCharacter = "ä".repeat(PROMPT_MAX_BYTES / 2);

    expect(decodeRequest({ agent: "codex", prompt: twoBytesPerCharacter }).prompt).toHaveLength(
      PROMPT_MAX_BYTES / 2,
    );
    expect(() => decodeRequest({ agent: "codex", prompt: `${twoBytesPerCharacter}a` })).toThrow(
      PROMPT_RANGE_MESSAGE,
    );
  });

  it.each(["gemini", "", null])("rejects the unknown agent %j", (agent) => {
    expect(() => decodeRequest({ agent, prompt: "Hello" })).toThrow();
  });
});
