import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

export const EMBEDDING_DIM = 1536;

/**
 * Produces embeddings for opportunity text and builder profiles.
 *
 * Two providers, and the choice matters for how you read results:
 *
 *   voyage  — real semantic embeddings (Anthropic's recommended provider).
 *             Requires VOYAGE_API_KEY. Use this in production.
 *
 *   local   — a deterministic hashed bag-of-words projection. It is NOT
 *             semantic: "hackathon" and "buildathon" land in unrelated
 *             dimensions. It exists so the pipeline runs end-to-end without
 *             an API key, and so tests are hermetic. Lexical overlap still
 *             scores, so results are coherent rather than random — but do
 *             not mistake it for real retrieval quality.
 *
 * The active provider is reported on every feed response so nobody
 * benchmarks the fallback and concludes the ranking is bad.
 */
export type EmbeddingProvider = 'voyage' | 'local';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);

  constructor(private readonly config: ConfigService) {}

  get provider(): EmbeddingProvider {
    return this.config.get<string>('VOYAGE_API_KEY') ? 'voyage' : 'local';
  }

  async embed(text: string): Promise<number[]> {
    if (this.provider === 'voyage') {
      try {
        return await this.embedVoyage(text);
      } catch (err) {
        // Never fail an ingest because a third party had a bad minute.
        // Degrade to local and say so loudly.
        this.logger.warn(
          `Voyage embedding failed, falling back to local: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    return this.embedLocal(text);
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }

  private async embedVoyage(text: string): Promise<number[]> {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.get<string>('VOYAGE_API_KEY')}`,
      },
      body: JSON.stringify({
        model: this.config.get<string>('VOYAGE_MODEL') ?? 'voyage-3',
        input: [text.slice(0, 8000)],
      }),
    });

    if (!res.ok) {
      throw new Error(`Voyage responded ${res.status}`);
    }

    const body = (await res.json()) as {
      data?: { embedding: number[] }[];
    };
    const vector = body.data?.[0]?.embedding;
    if (!vector) throw new Error('Voyage returned no embedding');

    return this.fit(vector);
  }

  /**
   * Deterministic hashed projection. Each token is hashed to a handful of
   * dimensions with a stable sign, then the vector is L2-normalised so
   * cosine distance behaves. Same input always yields the same vector.
   */
  private embedLocal(text: string): number[] {
    const vector = new Array<number>(EMBEDDING_DIM).fill(0);
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    for (const token of tokens) {
      const digest = createHash('sha256').update(token).digest();
      // Four buckets per token keeps collisions from dominating.
      for (let k = 0; k < 4; k++) {
        const idx =
          ((digest[k * 4] << 8) | digest[k * 4 + 1]) % EMBEDDING_DIM;
        const sign = digest[k * 4 + 2] % 2 === 0 ? 1 : -1;
        vector[idx] += sign;
      }
    }

    return this.normalise(vector);
  }

  /** Pad or truncate a provider vector to our column width. */
  private fit(vector: number[]): number[] {
    if (vector.length === EMBEDDING_DIM) return this.normalise(vector);
    const out = new Array<number>(EMBEDDING_DIM).fill(0);
    for (let i = 0; i < Math.min(vector.length, EMBEDDING_DIM); i++) {
      out[i] = vector[i];
    }
    return this.normalise(out);
  }

  private normalise(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
    if (magnitude === 0) return vector;
    return vector.map((v) => v / magnitude);
  }

  /** pgvector literal form: '[0.1,0.2,...]' */
  static toSqlVector(vector: number[]): string {
    return `[${vector.map((v) => v.toFixed(6)).join(',')}]`;
  }
}
