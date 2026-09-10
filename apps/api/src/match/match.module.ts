import { Module } from '@nestjs/common';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { UsageService } from '../billing/usage.service';

@Module({
  imports: [EmbeddingsModule, ProfilesModule],
  controllers: [MatchController],
  providers: [MatchService, UsageService],
  exports: [MatchService],
})
export class MatchModule {}
