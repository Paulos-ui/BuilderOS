import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentCardController } from './agent-card.controller';
import { NetworkModule } from '../config/network.module';
import { PayModule } from '../pay/pay.module';

@Module({
  // The agent card publishes payment terms alongside capabilities, so it needs
  // X402Service to report them from the same source the 402 challenge uses.
  imports: [NetworkModule, PayModule],
  controllers: [AgentsController, AgentCardController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
