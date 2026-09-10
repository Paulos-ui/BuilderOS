import { Injectable, NotFoundException } from '@nestjs/common';
import type { ApplicationStage } from '@prisma/client';
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

  /**
   * Cross-agent overview for the console home.
   *
   * ── Why these are five separate counts and not one findMany ───────────────
   *
   * The previous version fetched `take: 5` rows and then reported
   * `tracked.length` as `tracking`. A builder with forty open applications saw
   * "5". Worse, `urgent` was filtered from those same five, so the urgent count
   * was capped at five as well, and both numbers looked completely plausible —
   * there is nothing in a "5" that says it was truncated. The console home now
   * leads with these figures, which makes a silently-wrong total the most
   * expensive kind of bug in this file.
   *
   * ── Overdue is separated from urgent on purpose ──────────────────────────
   *
   * The old filter was `(deadline - now) / day <= 7`, which is also true for
   * every deadline that has already passed. Those rows then supplied
   * `nextDeadline`, so the console could present a date from last month under
   * the word "next". Overdue work is genuinely urgent, so it stays counted in
   * `urgent`, but it is reported separately and `nextDeadline` only ever looks
   * forward.
   */
  async pipeline(builderProfileId: string) {
    const now = new Date();
    const horizon = new Date(now.getTime() + 7 * 86_400_000);

    // Stages where a deadline no longer means anything actionable.
    const CLOSED: ApplicationStage[] = ['WON', 'REJECTED', 'ABANDONED'];
    const open = { builderProfileId, stage: { notIn: CLOSED } };

    const [tracking, dueSoon, overdue, next, proofRecords, agentCalls] =
      await Promise.all([
        this.prisma.trackedApplication.count({ where: { builderProfileId } }),
        this.prisma.trackedApplication.count({
          where: { ...open, deadline: { gte: now, lte: horizon } },
        }),
        this.prisma.trackedApplication.count({
          where: { ...open, deadline: { lt: now } },
        }),
        this.prisma.trackedApplication.findFirst({
          where: { ...open, deadline: { gte: now } },
          orderBy: { deadline: 'asc' },
          select: { id: true, title: true, deadline: true },
        }),
        this.prisma.proofRecord.count({ where: { builderProfileId } }),
        this.prisma.usageRecord.count({ where: { builderProfileId } }),
      ]);

    return {
      tracking,
      /** Open applications closing within seven days, plus anything already past due. */
      urgent: dueSoon + overdue,
      overdue,
      proofRecords,
      agentCalls,
      nextDeadline: next?.deadline
        ? {
            title: next.title,
            deadline: next.deadline.toISOString(),
            applicationId: next.id,
          }
        : null,
    };
  }
}
