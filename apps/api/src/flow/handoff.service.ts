import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The coordination layer.
 *
 * Until now each agent worked but none of them handed off, which made the
 * product four tools sharing a login rather than a system. These are the
 * three transitions that turn it into one workflow:
 *
 *   Scout  -> Flow   track an opportunity you found
 *   Flow   -> Forge  review a tracked application, with its context
 *   Flow   -> Rep    a won application becomes a proof record
 *
 * Each carries structured state forward, so the builder never re-types
 * something the system already knows.
 */
@Injectable()
export class HandoffService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Scout -> Flow.
   *
   * Idempotent on (profile, opportunity): clicking "track" twice returns the
   * existing item rather than creating a duplicate. Double-submission is the
   * normal case on a slow connection, not an edge case.
   */
  async trackOpportunity(
    builderProfileId: string,
    opportunityId: string,
  ): Promise<{ id: string; created: boolean; title: string }> {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        deadline: true,
        description: true,
      },
    });
    if (!opportunity) throw new NotFoundException('Opportunity not found');

    const existing = await this.prisma.trackedApplication.findFirst({
      where: { builderProfileId, opportunityId },
      select: { id: true, title: true },
    });
    if (existing) {
      return { id: existing.id, created: false, title: existing.title };
    }

    const row = await this.prisma.trackedApplication.create({
      data: {
        builderProfileId,
        opportunityId: opportunity.id,
        title: opportunity.title,
        sourceUrl: opportunity.sourceUrl,
        deadline: opportunity.deadline,
        // Seeded so ProofForge has the opportunity's own wording to work
        // against rather than a blank page.
        notes: opportunity.description?.slice(0, 2000) ?? null,
        checklist: [
          { label: 'Problem statement is specific and quantified', done: false },
          { label: 'Milestones have dates and verifiable outputs', done: false },
          { label: 'Budget is broken into line items', done: false },
          { label: 'Repository or prior work is linked', done: false },
          { label: 'Reviewed with ProofForge', done: false },
          { label: 'Submitted before the deadline', done: false },
        ] as unknown as object,
      },
    });

    return { id: row.id, created: true, title: row.title };
  }

  /** Flow -> Forge. Returns the context ProofForge should open against. */
  async reviewContext(builderProfileId: string, applicationId: string) {
    const app = await this.prisma.trackedApplication.findFirst({
      where: { id: applicationId, builderProfileId },
    });
    if (!app) throw new NotFoundException('Application not found');

    return {
      applicationId: app.id,
      title: app.title,
      sourceUrl: app.sourceUrl,
      deadline: app.deadline?.toISOString() ?? null,
      // Whatever the opportunity said, so the builder is not starting cold.
      context: app.notes ?? null,
      lastScore: app.lastScore,
    };
  }

  /** Records a ProofForge score back onto the tracked application. */
  async recordScore(
    builderProfileId: string,
    applicationId: string,
    score: number,
  ): Promise<void> {
    const app = await this.prisma.trackedApplication.findFirst({
      where: { id: applicationId, builderProfileId },
      select: { id: true, checklist: true },
    });
    if (!app) return;

    const checklist = Array.isArray(app.checklist)
      ? (app.checklist as { label: string; done: boolean }[])
      : [];

    // Reviewing with ProofForge ticks its own checklist item — the system
    // should not ask you to confirm something it just watched you do.
    const updated = checklist.map((c) =>
      c.label.includes('ProofForge') ? { ...c, done: true } : c,
    );

    await this.prisma.trackedApplication.update({
      where: { id: applicationId },
      data: {
        lastScore: Math.round(score),
        checklist: updated as unknown as object,
      },
    });
  }

  /**
   * Flow -> Rep.
   *
   * A won application becomes a proof record. Marked verified: false,
   * because the platform observed you marking it won, which is not the same
   * as independently confirming the programme awarded it. Treating
   * self-report as verification would hollow out the one distinction that
   * makes a reputation record worth anything.
   */
  async promoteToProof(
    builderProfileId: string,
    applicationId: string,
  ): Promise<{ id: string; created: boolean }> {
    const app = await this.prisma.trackedApplication.findFirst({
      where: { id: applicationId, builderProfileId },
    });
    if (!app) throw new NotFoundException('Application not found');

    const existing = await this.prisma.proofRecord.findFirst({
      where: { builderProfileId, applicationId },
      select: { id: true },
    });
    if (existing) return { id: existing.id, created: false };

    const row = await this.prisma.proofRecord.create({
      data: {
        builderProfileId,
        applicationId: app.id,
        kind: 'grant_completed',
        title: app.title,
        description: `Application completed through BuilderOS.${
          app.lastScore ? ` ProofForge score at review: ${app.lastScore}.` : ''
        }`,
        evidenceUrl: app.sourceUrl,
        occurredAt: new Date(),
        verified: false,
        metadata: {
          promotedFrom: 'builderflow',
          stage: app.stage,
        } as unknown as object,
      },
    });

    return { id: row.id, created: true };
  }

  /** Cross-agent overview for the console home. */
  async pipeline(builderProfileId: string) {
    const [tracked, proofs, usage] = await Promise.all([
      this.prisma.trackedApplication.findMany({
        where: { builderProfileId },
        orderBy: { deadline: 'asc' },
        take: 5,
      }),
      this.prisma.proofRecord.count({ where: { builderProfileId } }),
      this.prisma.usageRecord.count({ where: { builderProfileId } }),
    ]);

    const now = Date.now();
    const urgent = tracked.filter(
      (t) =>
        t.deadline &&
        !['WON', 'REJECTED', 'ABANDONED'].includes(t.stage) &&
        (t.deadline.getTime() - now) / 86_400_000 <= 7,
    );

    return {
      tracking: tracked.length,
      urgent: urgent.length,
      proofRecords: proofs,
      agentCalls: usage,
      nextDeadline: urgent[0]
        ? {
            title: urgent[0].title,
            deadline: urgent[0].deadline!.toISOString(),
            applicationId: urgent[0].id,
          }
        : null,
    };
  }
}
