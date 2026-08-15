import { Module } from '@nestjs/common';
import { OpportunitiesController } from './opportunities.controller';
import { FeedService } from './feed.service';
import { IngestionService } from './ingestion.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { GitcoinSource } from './sources/gitcoin.source';
import { DevpostSource } from './sources/devpost.source';
import { GoatSource } from './sources/goat.source';

@Module({
  controllers: [OpportunitiesController],
  providers: [
    FeedService,
    IngestionService,
    EmbeddingsService,
    GitcoinSource,
    DevpostSource,
    GoatSource,
  ],
  exports: [FeedService, IngestionService],
})
export class OpportunitiesModule {}
