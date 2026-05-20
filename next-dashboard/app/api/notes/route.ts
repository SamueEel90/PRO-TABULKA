import { NextResponse } from 'next/server';

import { ensureCacheFresh, ensureCacheFreshForRequest, setAfterSaveCookie } from '@/lib/db/client';
import { sendNotificationEmail } from '@/lib/mailer';
import { prisma } from '@/lib/prisma';
import { newId, nowIso, pushBatch, type BatchOp } from '@/lib/sheets/write-through';

/**
 * GET /api/notes?scopeKey=...&metricKey=...&broadcastScopeKey=...
 *
 * Returns comment thread for a given scope + metric.
 * If broadcastScopeKey is provided (store view), also includes comments
 * written at VKL level (broadcast), marked with isBroadcast=true.
 */
export async function GET(request: Request) {
  try {
    await ensureCacheFreshForRequest(request);

    const url = new URL(request.url);
    const scopeKey = url.searchParams.get('scopeKey') || '';
    const metricKey = url.searchParams.get('metricKey') || '';
    const broadcastScopeKey = url.searchParams.get('broadcastScopeKey') || '';

    if (!scopeKey || !metricKey) {
      return NextResponse.json({ ok: false, error: 'scopeKey and metricKey are required.' }, { status: 400 });
    }

    const scopeKeys = [scopeKey];
    if (broadcastScopeKey && broadcastScopeKey !== scopeKey) {
      scopeKeys.push(broadcastScopeKey);
    }

    const rawComments = await prisma.noteComment.findMany({
      where: {
        scopeKey: { in: scopeKeys },
        metricKey,
      },
      orderBy: { createdAt: 'asc' },
      include: { task: true },
    });

    const comments = rawComments.map((comment) => ({
      id: comment.id,
      scopeKey: comment.scopeKey,
      metricKey: comment.metricKey,
      role: comment.role,
      author: comment.author,
      text: comment.text,
      createdAt: comment.createdAt,
      isBroadcast: broadcastScopeKey ? comment.scopeKey === broadcastScopeKey : false,
      task: comment.task
        ? {
            id: comment.task.id,
            status: comment.task.status,
            completedByName: comment.task.completedByName,
            completedAt: comment.task.completedAt,
          }
        : null,
    }));

    return NextResponse.json({ ok: true, comments });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Nepodarilo sa načítať komentáre.' }, { status: 500 });
  }
}

/**
 * POST /api/notes
 * Body: { scopeKey, metricKey, role, author, text, createTask?: boolean }
 */
export async function POST(request: Request) {
  try {
    await ensureCacheFresh({ force: true });

    const body = await request.json() as {
      scopeKey?: string;
      metricKey?: string;
      role?: string;
      author?: string;
      text?: string;
      createTask?: boolean;
    };

    const { scopeKey, metricKey, role, author, text, createTask } = body;

    if (!scopeKey || !metricKey || !role || !author || !String(text || '').trim()) {
      return NextResponse.json({ ok: false, error: 'scopeKey, metricKey, role, author, and text are required.' }, { status: 400 });
    }

    const trimmedText = String(text).trim();
    const now = nowIso();

    // Build all 2-3 records (NoteComment + optional TaskItem + ActivityEntry)
    // up front. ONE pushBatch replaces what used to be 2-3 sequential pushNew
    // calls — each paid ~3-5s Apps Script Web App baseline. Combined ~3-5s
    // instead of 9-15s.
    const commentRecord = {
      id: newId(),
      scopeKey,
      metricKey,
      role,
      author,
      text: trimmedText,
      createdAt: now,
    };

    const taskRecord = createTask
      ? {
          id: newId(),
          scopeKey,
          metricKey,
          monthLabel: null,
          text: trimmedText,
          status: 'open',
          createdByRole: role,
          createdByName: author,
          createdAt: now,
          completedByName: null,
          completedAt: null,
          sourceCommentId: commentRecord.id,
        }
      : null;

    const activityRecord = {
      id: newId(),
      scopeKey,
      actorRole: role,
      actorName: author,
      action: createTask ? 'task-created' : 'comment',
      metricKey,
      monthLabel: null,
      detail: trimmedText.slice(0, 200),
      createdAt: now,
    };

    const batchOps: BatchOp[] = [
      { op: 'bulkAppend', tab: 'NoteComment', records: [commentRecord] },
    ];
    if (taskRecord) {
      batchOps.push({ op: 'bulkAppend', tab: 'TaskItem', records: [taskRecord] });
    }
    batchOps.push({ op: 'bulkAppend', tab: 'ActivityEntry', records: [activityRecord] });

    await pushBatch(batchOps);

    // Mirror into local cache after the unified Sheets write succeeds.
    const comment = await prisma.noteComment.create({
      data: {
        ...commentRecord,
        createdAt: new Date(now),
      },
    });

    let task = null;
    if (taskRecord) {
      task = await prisma.taskItem.create({
        data: {
          ...taskRecord,
          createdAt: new Date(now),
          completedAt: null,
        },
      });
      void notifyTaskAssigned({ scopeKey, metricKey, role, author, text: trimmedText });
    }

    try {
      await prisma.activityEntry.create({
        data: { ...activityRecord, createdAt: new Date(now) },
      });
    } catch {
      /* best effort — activity log shouldn't break note creation */
    }

    return setAfterSaveCookie(NextResponse.json({ ok: true, comment, task }));
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Nepodarilo sa pridať komentár.' }, { status: 500 });
  }
}

async function notifyTaskAssigned(input: {
  scopeKey: string;
  metricKey: string;
  role: string;
  author: string;
  text: string;
}) {
  try {
    const recipients: Array<{ email: string; storeId: string | null }> = [];

    if (input.scopeKey.startsWith('STORE|')) {
      const storeId = input.scopeKey.split('|')[1] || '';
      const vodUsers = await prisma.user.findMany({
        where: { primaryStoreId: storeId, role: 'VOD', email: { not: '' } },
        select: { email: true, primaryStoreId: true },
      });
      vodUsers.forEach((user) => recipients.push({ email: user.email, storeId: user.primaryStoreId }));
    } else if (input.scopeKey.startsWith('AGGREGATE|VKL|')) {
      const vklName = input.scopeKey.split('|').slice(2).join('|');
      const vodUsers = await prisma.user.findMany({
        where: { vklName, role: 'VOD', email: { not: '' } },
        select: { email: true, primaryStoreId: true },
      });
      vodUsers.forEach((user) => recipients.push({ email: user.email, storeId: user.primaryStoreId }));
    }

    if (!recipients.length) return;

    const subject = `Nová úloha: ${input.metricKey || 'všeobecné'}`;
    const body = `${input.author} (${input.role}) ti pridelil úlohu k metrike „${input.metricKey || '—'}":\n\n${input.text}\n\nOtvor PRO TABULKA pre detail.`;

    await Promise.all(
      recipients.map((recipient) =>
        sendNotificationEmail({
          to: recipient.email,
          subject,
          text: body,
          context: {
            scopeKey: input.scopeKey,
            metricKey: input.metricKey,
            recipientStoreId: recipient.storeId,
            event: 'task-assigned',
          },
        }),
      ),
    );
  } catch {
    /* best effort */
  }
}
