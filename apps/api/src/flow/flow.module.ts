import { Module } from '@nestjs/common';
import { FlowController } from './flow.controller';
import { FlowService } from './flow.service';
import { HandoffController } from './handoff.controller';
import { HandoffService } from './handoff.service';

@Module({
  controllers: [FlowController, HandoffController],
  providers: [FlowService, HandoffService],
  exports: [FlowService, HandoffService],
})
export class FlowModule {}
