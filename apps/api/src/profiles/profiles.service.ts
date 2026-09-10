import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async findById(builderProfileId: string) {
    const profile = await this.prisma.builderProfile.findUnique({
      where: { id: builderProfileId },
      include: {
        user: {
          select: { email: true, walletAddress: true, createdAt: true },
        },
      },
    });
    if (!profile) throw new NotFoundException('Builder profile not found');
    return profile;
  }

  async update(builderProfileId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.builderProfile.update({
      where: { id: builderProfileId },
      data: {
        ...(dto.githubUsername !== undefined && {
          githubUsername: dto.githubUsername,
        }),
        ...(dto.chains !== undefined && { chains: dto.chains }),
        ...(dto.languages !== undefined && { languages: dto.languages }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
      },
    });

    // The vector is what BuilderMatch reads, so it has to be refreshed
    // whenever the text behind it changes. Deliberately awaited rather than
    // fired and forgotten: a caller that saves a profile and immediately asks
    // for collaborators should not race an unwritten embedding and be told it
    // has no match.
    await this.refreshEmbedding(profile.id);

    return profile;
  }

  /**
   * Public-facing view of a profile (for the shareable reputation page,
   * Blueprint Section 9.3) — deliberately excludes email/wallet and any
   * internal fields.
   */
  async findPublicById(builderProfileId: string) {
    const profile = await this.prisma.builderProfile.findUnique({
      where: { id: builderProfileId },
      select: {
        id: true,
        githubUsername: true,
        chains: true,
        languages: true,
        bio: true,
        createdAt: true,
      },
    });
    if (!profile) throw new NotFoundException('Builder profile not found');
    return profile;
  }

  /**
   * Builds the text BuilderMatch reasons over.
   *
   * Kept in one place, and shaped so the strongest signals repeat: chains and
   * languages are the fields a collaborator actually filters on, and a bio is
   * often three times their length. Without the repetition a long rambling bio
   * drowns out "Solidity, Bitcoin" entirely, and matches drift towards people
   * who write similarly rather than people who build similarly.
   */
  static profileText(p: {
    chains: unknown;
    languages: unknown;
    bio: string | null;
    githubUsername: string | null;
  }): string {
    const list = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

    const chains = list(p.chains);
    const languages = list(p.languages);

    return [
      ...chains,
      ...chains,
      ...languages,
      ...languages,
      p.githubUsername ?? '',
      p.bio ?? '',
    ]
      .join(' ')
      .trim();
  }

  /**
   * Writes the profile vector.
   *
   * Raw SQL for the same reason ingestion uses it: Prisma has no typed
   * representation for a pgvector column, so this is the supported path rather
   * than a workaround. `id` is TEXT, not Postgres's native uuid — Prisma
   * generates it client-side — so there is no ::uuid cast here.
   *
   * Never throws. A builder editing their bio must not see a 500 because an
   * embedding provider had a bad minute; the cost of a stale vector is a
   * slightly worse match list, which is recoverable on the next save.
   */
  async refreshEmbedding(builderProfileId: string): Promise<boolean> {
    try {
      const profile = await this.prisma.builderProfile.findUnique({
        where: { id: builderProfileId },
        select: {
          chains: true,
          languages: true,
          bio: true,
          githubUsername: true,
        },
      });
      if (!profile) return false;

      const text = ProfilesService.profileText(profile);

      // An empty profile has nothing to embed. Writing the zero vector would
      // be worse than writing nothing: cosine distance against zero is
      // undefined, and every empty profile would appear maximally similar to
      // every other. NULL is the honest value, and the match query skips it.
      if (text.length < 10) {
        await this.prisma.$executeRawUnsafe(
          `UPDATE builder_profiles SET embedding = NULL WHERE id = $1`,
          builderProfileId,
        );
        return false;
      }

      const vector = await this.embeddings.embed(text);
      await this.prisma.$executeRawUnsafe(
        `UPDATE builder_profiles SET embedding = $1::vector WHERE id = $2`,
        EmbeddingsService.toSqlVector(vector),
        builderProfileId,
      );
      return true;
    } catch (err) {
      this.logger.warn(
        `Profile embedding write failed for ${builderProfileId} (non-fatal): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }
}
