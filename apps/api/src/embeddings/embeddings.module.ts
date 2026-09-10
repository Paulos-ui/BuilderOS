import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';

/**
 * EmbeddingsService used to be provided ad hoc inside OpportunitiesModule,
 * which was fine while opportunities were the only consumer. Once profiles
 * and BuilderMatch also needed vectors, that arrangement would have meant
 * three separate instances each holding their own provider decision — and
 * three places to change when the provider changes.
 *
 * Exported from one module instead, so every consumer agrees on whether
 * embeddings are real (Voyage) or the deterministic local fallback. That
 * agreement matters: match scores computed against local vectors and
 * opportunity scores computed against Voyage vectors would not be comparable,
 * and nothing in the response would have revealed the mismatch.
 */
@Module({
  providers: [EmbeddingsService],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
