import { NextResponse } from 'next/server';

import { sendNotificationEmail } from '@/lib/mailer';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/notes?scopeKey=...&metricKey=...&broadcastScopeKey=...
 *
 * Returns comment thread for a given scope + metric.
 * If broadcastScopeKey is provided (store view), also includes comments
 * written at VKL level (broadcast), marked with isBroadcast=true.
 *
 * Scoping logic:
 * - VKL at VKL-level (no store selected) → writes to AGGREGATE|VKL|{vklName} → visible to ALL stores
 * - VKL at store-level → writes to STORE|{storeId} → visible only to that store
 * - VOD → writes to STORE|{storeId} → visible to that store + VKL
 * - When fetching for a store, broadcastScopeKey pulls in VKL-level comments too
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scopeKey = url.searchParams.get('scopeKey') || '';
    const metricKey = url.searchParams.get('metricKey') || '';
    const broadcastScopeKey = url.searchParams.get('broadcastScopeKey') || '';

    if (!scopeKey || !metricKey) {
      return NextResponse.json({ ok: false, error: 'scopeKey and metricKey are required.' }, { status: 400 });
    }

    // Fetch store-level comments
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

    // Mark broadcast comments (those from VKL-level scope) and flatten task info
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
 * Adds a new comment to the thread. If createTask=true, also creates a linked TaskItem.
 */
export async function POST(request: Request) {
  try {
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

    const comment = await prisma.noteComment.create({
      data: {
        scopeKey,
        metricKey,
        role,
        author,
        text: trimmedText,
      },
    });

    // Optionally create linked task
    let task = null;
    if (createTask) {
      task = await prisma.taskItem.create({
        data: {
          scopeKey,
          metricKey,
          text: trimmedText,
          createdByRole: role,
          createdByName: author,
          sourceCommentId: comment.id,
        },
      });

      // Notify the VOD assigned to the store (best-effort, dev override)
      void notifyTaskAssigned({ scopeKey, metricKey, role, author, text: trimmedText });
    }

    // Log activity
    await prisma.activityEntry.create({
      data: {
        scopeKey,
        actorRole: role,
        actorName: author,
        action: createTask ? 'task-created' : 'comment',
        metricKey,
        detail: trimmedText.slice(0, 200),
      },
    }).catch(() => { /* best effort */ });

    return NextResponse.json({ ok: true, comment, task });
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

    if (!recipients.length) {
      return;
    }

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
  } catch (error) {
    /* best effort */
  }
}
