import { PROMPT_MAX_BYTES, PROMPT_RANGE_MESSAGE } from "@eitri/contracts/agent";
import { describe, expect, it } from "vite-plus/test";
import { readAgentAnswer, toAgentRequest } from "./agent.ts";

describe("toAgentRequest", () => {
  it("passes valid input through as the request the adapters send", () => {
    expect(toAgentRequest("claude", "Hello")).toEqual({ agent: "claude", prompt: "Hello" });
  });

  it("reports a rejected prompt in the wording the backend uses", () => {
    expect(() => toAgentRequest("codex", " ")).toThrow(new Error(PROMPT_RANGE_MESSAGE));
    expect(() => toAgentRequest("codex", "a".repeat(PROMPT_MAX_BYTES + 1))).toThrow(
      new Error(PROMPT_RANGE_MESSAGE),
    );
  });

  it("rejects an agent the backend cannot run", () => {
    expect(() => toAgentRequest("gemini", "Hello")).toThrow(/codex/);
  });
});

describe("readAgentAnswer", () => {
  it("returns the answer of a well-behaved backend", () => {
    expect(readAgentAnswer("Hello from the agent")).toBe("Hello from the agent");
  });

  it.each([{ unexpected: true }, undefined, 1])("rejects the payload %j", (reply) => {
    expect(() => readAgentAnswer(reply)).toThrow("Unexpected response");
  });
});
