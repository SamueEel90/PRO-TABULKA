import { NextResponse } from 'next/server';

import { ensureCacheFresh } from '@/lib/db/client';
import { prisma } from '@/lib/prisma';
import { newId, nowIso, pushNew } from '@/lib/sheets/write-through';

/**
 * GET /api/tasks?scopeKey=...&broadcastScopeKey=...&metricKey=...
 * Returns tasks for the given scope (and optionally a parent broadcast scope).
 * If metricKey is provided, returns only tasks for that metric.
 */
export async function GET(request: Request) {
  try {
    await ensureCacheFresh({ force: true });
    const url = new URL(request.url);
    const scopeKey = url.searchParams.get('scopeKey') || '';
    const broadcastScopeKey = url.searchParams.get('broadcastScopeKey') || '';
    const metricKey = url.searchParams.get('metricKey') || '';

    if (!scopeKey) {
      return NextResponse.json({ ok: false, error: 'scopeKey is required.' }, { status: 400 });
    }

    const scopeKeys = [scopeKey];
    if (broadcastScopeKey && broadcastScopeKey !== scopeKey) {
      scopeKeys.push(broadcastScopeKey);
    }

    const tasks = await prisma.taskItem.findMany({
      where: {
        scopeKey: { in: scopeKeys },
        ...(metricKey ? { metricKey } : {}),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    const counts = {
      open: tasks.filter((task) => task.status === 'open').length,
      done: tasks.filter((task) => task.status === 'done').length,
      total: tasks.length,
    };

    return NextResponse.json({ ok: true, tasks, counts });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Nepodarilo sa načítať úlohy.' }, { status: 500 });
  }
}

/**
 * POST /api/tasks
 * Body: { scopeKey, metricKey?, monthLabel?, text, createdByRole, createdByName, sourceCommentId? }
 * Creates a new task.
 */
export async function POST(request: Request) {
  try {
    await ensureCacheFresh({ force: true });
    const body = await request.json() as {
      scopeKey?: string;
      metricKey?: string;
      monthLabel?: string;
      text?: string;
      createdByRole?: string;
      createdByName?: string;
      sourceCommentId?: string;
    };

    const { scopeKey, metricKey, monthLabel, text, createdByRole, createdByName, sourceCommentId } = body;

    if (!scopeKey || !text || !createdByRole || !createdByName) {
      return NextResponse.json({ ok: false, error: 'scopeKey, text, createdByRole, createdByName are required.' }, { status: 400 });
    }

    const trimmedText = String(text).trim();
    const now = nowIso();

    const taskRecord = {
      id: newId(),
      scopeKey,
      metricKey: metricKey || null,
      monthLabel: monthLabel || null,
      text: trimmedText,
      status: 'open',
      createdByRole,
      createdByName,
      createdAt: now,
      completedByName: null,
      completedAt: null,
      sourceCommentId: sourceCommentId || null,
    };
    await pushNew('TaskItem', taskRecord);
    const task = await prisma.taskItem.create({
      data: { ...taskRecord, createdAt: new Date(now), completedAt: null },
    });

    try {
      const activityRecord = {
        id: newId(),
        scopeKey,
        actorRole: createdByRole,
        actorName: createdByName,
        action: 'task-created',
        metricKey: metricKey || null,
        monthLabel: monthLabel || null,
        detail: trimmedText.slice(0, 200),
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
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Nepodarilo sa vytvoriť úlohu.' }, { status: 500 });
  }
}
