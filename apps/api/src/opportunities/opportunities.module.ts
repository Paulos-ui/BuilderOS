import { Module } from '@nestjs/common';
import { OpportunitiesController } from './opportunities.controller';
import { DiagnosticsController } from './diagnostics.controller';
import { FeedService } from './feed.service';
import { IngestionService } from './ingestion.service';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { GitcoinSource } from './sources/gitcoin.source';
import { DevpostSource } from './sources/devpost.source';
import { GoatSource } from './sources/goat.source';

@Module({
  // EmbeddingsService was listed as a local provider here. It is shared with
  // profiles and BuilderMatch now, so it comes from its own module — one
  // instance, one provider decision.
  imports: [EmbeddingsModule],
  controllers: [OpportunitiesController, DiagnosticsController],
  providers: [
    FeedService,
    IngestionService,
    GitcoinSource,
    DevpostSource,
    GoatSource,
  ],
  exports: [FeedService, IngestionService],
})
export class OpportunitiesModule {}
