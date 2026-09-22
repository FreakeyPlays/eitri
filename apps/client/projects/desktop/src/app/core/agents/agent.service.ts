import { inject, Service } from "@angular/core";
import type { AgentRequest } from "@eitri/contracts/agent";
import { ServerService } from "@core/server/server.service";

@Service()
export class AgentService {
  private readonly server = inject(ServerService);

  /** Runs one prompt through an installed CLI; rejects with a sentence the user can act on. */
  ask(request: AgentRequest): Promise<string> {
    return this.server.call("agent.ask", request);
  }
}
