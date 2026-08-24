import { Module } from '@nestjs/common';
import { ProofForgeController } from './proofforge.controller';
import { ScoringService } from './scoring.service';
import { UsageService } from '../billing/usage.service';

@Module({
  controllers: [ProofForgeController],
  providers: [ScoringService, UsageService],
  exports: [ScoringService],
})
export class ProofForgeModule {}
