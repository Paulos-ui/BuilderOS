import { Controller, Get } from '@nestjs/common';
import { AgentsService } from './agents.service';

@Controller('v1/agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  /**
   * Public on purpose: everything returned is already public on-chain data,
   * and leaving it open means a reviewer can verify our ERC-8004 claims with
   * a single curl, without needing an account.
   */
  @Get()
  getAgents() {
    return this.agentsService.getAgents();
  }
}
