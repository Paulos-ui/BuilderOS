import { Module } from '@nestjs/common';
import { ProofForgeController } from './proofforge.controller';
import { ScoringService } from './scoring.service';
import { UsageService } from '../billing/usage.service';
import { PayModule } from '../pay/pay.module';

@Module({
  // PayModule supplies X402Interceptor for the metered `score` route.
  imports: [PayModule],
  controllers: [ProofForgeController],
  providers: [ScoringService, UsageService],
  exports: [ScoringService],
})
export class ProofForgeModule {}
