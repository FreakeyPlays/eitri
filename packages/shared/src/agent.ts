import { type AgentRequest, AgentAnswerSchema, AgentRequestSchema } from "@eitri/contracts/agent";
import * as Schema from "effect/Schema";

const decodeRequest = Schema.decodeUnknownSync(AgentRequestSchema);
const decodeAnswer = Schema.decodeUnknownSync(AgentAnswerSchema);

/**
 * Turns raw input into a request the backend accepts, so a client rejects a bad
 * prompt with the same rule and wording the backend does. Throws the
 * message meant for the user.
 */
export function toAgentRequest(agent: string, prompt: string): AgentRequest {
  try {
    return decodeRequest({ agent, prompt });
  } catch (error: unknown) {
    // A schema error appends the failing path; only its first line reads as a sentence.
    throw new Error(String(error instanceof Error ? error.message : error).split("\n")[0]);
  }
}

/** Reads a reply from any transport, so an unexpected payload never reaches the UI. */
export function readAgentAnswer(reply: unknown): string {
  try {
    return decodeAnswer(reply);
  } catch {
    throw new Error("Unexpected response from agent backend.");
  }
}
