import { Module } from '@nestjs/common';
import { ProofForgeController } from './proofforge.controller';
import { ScoringService } from './scoring.service';

@Module({
  controllers: [ProofForgeController],
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ProofForgeModule {}
