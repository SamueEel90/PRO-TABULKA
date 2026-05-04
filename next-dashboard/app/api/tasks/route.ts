import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

/**
 * GET /api/tasks?scopeKey=...&broadcastScopeKey=...&metricKey=...
 * Returns tasks for the given scope (and optionally a parent broadcast scope).
 * If metricKey is provided, returns only tasks for that metric.
 */
export async function GET(request: Request) {
  try {
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

    const task = await prisma.taskItem.create({
      data: {
        scopeKey,
        metricKey: metricKey || null,
        monthLabel: monthLabel || null,
        text: String(text).trim(),
        createdByRole,
        createdByName,
        sourceCommentId: sourceCommentId || null,
      },
    });

    // Log activity
    await prisma.activityEntry.create({
      data: {
        scopeKey,
        actorRole: createdByRole,
        actorName: createdByName,
        action: 'task-created',
        metricKey: metricKey || null,
        monthLabel: monthLabel || null,
        detail: String(text).trim().slice(0, 200),
      },
    }).catch(() => { /* best effort */ });

    return NextResponse.json({ ok: true, task });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Nepodarilo sa vytvoriť úlohu.' }, { status: 500 });
  }
}
