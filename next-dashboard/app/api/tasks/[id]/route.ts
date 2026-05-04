import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/tasks/[id]
 * Body: { status: 'open' | 'done' | 'dismissed', completedByName?: string }
 * Updates the status of a task.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json() as {
      status?: string;
      completedByName?: string;
    };

    const status = body.status;
    if (!id || !status) {
      return NextResponse.json({ ok: false, error: 'id and status are required.' }, { status: 400 });
    }

    if (!['open', 'done', 'dismissed'].includes(status)) {
      return NextResponse.json({ ok: false, error: 'Neplatný status.' }, { status: 400 });
    }

    const updateData: {
      status: string;
      completedByName: string | null;
      completedAt: Date | null;
    } = {
      status,
      completedByName: null,
      completedAt: null,
    };

    if (status === 'done' || status === 'dismissed') {
      updateData.completedByName = body.completedByName || null;
      updateData.completedAt = new Date();
    }

    const task = await prisma.taskItem.update({
      where: { id },
      data: updateData,
    });

    // Log activity
    await prisma.activityEntry.create({
      data: {
        scopeKey: task.scopeKey,
        actorRole: 'system',
        actorName: body.completedByName || 'Neznámy',
        action: status === 'done' ? 'task-completed' : status === 'dismissed' ? 'task-dismissed' : 'task-reopened',
        metricKey: task.metricKey,
        monthLabel: task.monthLabel,
        detail: task.text.slice(0, 200),
      },
    }).catch(() => { /* best effort */ });

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
    const { id } = await params;
    await prisma.taskItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Nepodarilo sa zmazať úlohu.' }, { status: 500 });
  }
}
