import { inject, Service } from "@angular/core";
import { AGENT_ENDPOINT, type AgentRequest } from "@eitri/contracts/agent";
import { readAgentAnswer } from "@eitri/shared/agent";

import { ClientService } from "@core/client/client.service";

@Service()
export class AgentService {
  private readonly client = inject(ClientService);

  async ask(request: AgentRequest): Promise<string> {
    const serverUrl = await this.client.getServerUrl();
    const endpoint = serverUrl ? new URL(AGENT_ENDPOINT, serverUrl).href : AGENT_ENDPOINT;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(130_000),
    }).catch((cause: unknown) => {
      throw new Error(
        "Could not reach the agent backend. Restart Eitri or check the server connection.",
        { cause },
      );
    });
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error(
        "Agent backend unavailable. Restart Eitri or check that the server is running.",
      );
    }
    const answer = readAgentAnswer(await response.json());
    if (!response.ok) {
      throw new Error(answer);
    }
    return answer;
  }
}
