import { NextResponse } from 'next/server';

import { ensureCacheFresh } from '@/lib/db/client';
import { prisma } from '@/lib/prisma';
import { newId, nowIso, pushDelete, pushNew, pushUpdate } from '@/lib/sheets/write-through';

/**
 * PATCH /api/tasks/[id]
 * Body: { status: 'open' | 'done' | 'dismissed', completedByName?: string }
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureCacheFresh();

    const { id } = await params;
    const body = await request.json() as { status?: string; completedByName?: string };

    const status = body.status;
    if (!id || !status) {
      return NextResponse.json({ ok: false, error: 'id and status are required.' }, { status: 400 });
    }
    if (!['open', 'done', 'dismissed'].includes(status)) {
      return NextResponse.json({ ok: false, error: 'Neplatný status.' }, { status: 400 });
    }

    const existing = await prisma.taskItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Úloha neexistuje.' }, { status: 404 });
    }

    const completedAt = (status === 'done' || status === 'dismissed') ? nowIso() : null;
    const completedByName = (status === 'done' || status === 'dismissed') ? (body.completedByName || null) : null;

    // Build full updated record for Sheets (all columns)
    const updatedRecord = {
      id: existing.id,
      scopeKey: existing.scopeKey,
      metricKey: existing.metricKey,
      monthLabel: existing.monthLabel,
      text: existing.text,
      status,
      createdByRole: existing.createdByRole,
      createdByName: existing.createdByName,
      createdAt: existing.createdAt.toISOString(),
      completedByName,
      completedAt,
      sourceCommentId: existing.sourceCommentId,
    };
    await pushUpdate('TaskItem', updatedRecord);

    const task = await prisma.taskItem.update({
      where: { id },
      data: {
        status,
        completedByName,
        completedAt: completedAt ? new Date(completedAt) : null,
      },
    });

    try {
      const now = nowIso();
      const activityRecord = {
        id: newId(),
        scopeKey: task.scopeKey,
        actorRole: 'system',
        actorName: body.completedByName || 'Neznámy',
        action: status === 'done' ? 'task-completed' : status === 'dismissed' ? 'task-dismissed' : 'task-reopened',
        metricKey: task.metricKey,
        monthLabel: task.monthLabel,
        detail: task.text.slice(0, 200),
        createdAt: now,
      };
      await pushNew('ActivityEntry', activityRecord);
      await prisma.activityEntry.create({
        data: { ...activityRecord, createdAt: new Date(now) },
      });
    } catch {
      /* best effort */
    }

    return NextResponse.json({ ok: true, task });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Nepodarilo sa upraviť úlohu.' }, { status: 500 });
  }
}

/**
 * DELETE /api/tasks/[id]
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureCacheFresh();
    const { id } = await params;
    await pushDelete('TaskItem', id);
    await prisma.taskItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Nepodarilo sa zmazať úlohu.' }, { status: 500 });
  }
}
