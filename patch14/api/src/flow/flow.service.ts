import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type Stage =
  | 'DRAFTING'
  | 'REVIEWING'
  | 'SUBMITTED'
  | 'WON'
  | 'REJECTED'
  | 'ABANDONED';

export interface ChecklistItem {
  label: string;
  done: boolean;
}

/** Default checklist. Derived from what actually gets applications rejected. */
const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { label: 'Problem statement is specific and quantified', done: false },
  { label: 'Milestones have dates and verifiable outputs', done: false },
  { label: 'Budget is broken into line items', done: false },
  { label: 'Repository or prior work is linked', done: false },
  { label: 'Reviewed with ProofForge', done: false },
  { label: 'Submitted before the deadline', done: false },
];

export interface FlowItem {
  id: string;
  title: string;
  sourceUrl: string | null;
  stage: Stage;
  deadline: string | null;
  daysLeft: number | null;
  urgency: 'overdue' | 'critical' | 'soon' | 'comfortable' | 'none';
  checklist: ChecklistItem[];
  progress: number;
  lastScore: number | null;
  notes: string | null;
  updatedAt: string;
}

@Injectable()
export class FlowService {
  constructor(private readonly prisma: PrismaService) {}

  async list(builderProfileId: string): Promise<{
    items: FlowItem[];
    counts: Record<string, number>;
  }> {
    const rows = await this.prisma.trackedApplication.findMany({
      where: { builderProfileId },
      orderBy: [{ deadline: 'asc' }, { updatedAt: 'desc' }],
    });

    const items = rows.map((r) => this.toItem(r));

    const counts = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.stage] = (acc[item.stage] ?? 0) + 1;
      return acc;
    }, {});

    return { items, counts };
  }

  async create(
    builderProfileId: string,
    input: {
      title: string;
      sourceUrl?: string;
      deadline?: string;
      opportunityId?: string;
    },
  ): Promise<FlowItem> {
    const row = await this.prisma.trackedApplication.create({
      data: {
        builderProfileId,
        title: input.title.trim(),
        sourceUrl: input.sourceUrl,
        opportunityId: input.opportunityId,
        deadline: input.deadline ? new Date(input.deadline) : null,
        checklist: DEFAULT_CHECKLIST as unknown as object,
      },
    });
    return this.toItem(row);
  }

  async update(
    builderProfileId: string,
    id: string,
    patch: {
      stage?: Stage;
      deadline?: string | null;
      notes?: string;
      checklist?: ChecklistItem[];
    },
  ): Promise<FlowItem> {
    const existing = await this.prisma.trackedApplication.findFirst({
      where: { id, builderProfileId },
    });
    if (!existing) throw new NotFoundException('Application not found');

    const row = await this.prisma.trackedApplication.update({
      where: { id },
      data: {
        ...(patch.stage && { stage: patch.stage }),
        ...(patch.deadline !== undefined && {
          deadline: patch.deadline ? new Date(patch.deadline) : null,
        }),
        ...(patch.notes !== undefined && { notes: patch.notes }),
        ...(patch.checklist && {
          checklist: patch.checklist as unknown as object,
        }),
      },
    });
    return this.toItem(row);
  }

  async remove(builderProfileId: string, id: string): Promise<{ ok: true }> {
    const existing = await this.prisma.trackedApplication.findFirst({
      where: { id, builderProfileId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Application not found');
    await this.prisma.trackedApplication.delete({ where: { id } });
    return { ok: true };
  }

  private toItem(row: {
    id: string;
    title: string;
    sourceUrl: string | null;
    stage: string;
    deadline: Date | null;
    notes: string | null;
    checklist: unknown;
    lastScore: number | null;
    updatedAt: Date;
  }): FlowItem {
    const daysLeft = row.deadline
      ? Math.ceil((row.deadline.getTime() - Date.now()) / 86_400_000)
      : null;

    // Urgency bands exist so the UI can sort attention, not just display a
    // number. "3 days left" and "3 weeks left" demand different behaviour.
    let urgency: FlowItem['urgency'] = 'none';
    if (daysLeft !== null) {
      if (daysLeft < 0) urgency = 'overdue';
      else if (daysLeft <= 3) urgency = 'critical';
      else if (daysLeft <= 10) urgency = 'soon';
      else urgency = 'comfortable';
    }

    const checklist = Array.isArray(row.checklist)
      ? (row.checklist as ChecklistItem[])
      : DEFAULT_CHECKLIST;

    const done = checklist.filter((c) => c.done).length;
    const progress = checklist.length
      ? Math.round((done / checklist.length) * 100)
      : 0;

    return {
      id: row.id,
      title: row.title,
      sourceUrl: row.sourceUrl,
      stage: row.stage as Stage,
      deadline: row.deadline?.toISOString() ?? null,
      daysLeft,
      urgency,
      checklist,
      progress,
      lastScore: row.lastScore,
      notes: row.notes,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
