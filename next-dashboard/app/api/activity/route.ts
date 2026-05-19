import { NextResponse } from 'next/server';

import { ensureCacheFresh } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { nowIso, pushNew, pushUpdate } from '@/lib/sheets/write-through';

/** Deterministic id so the same (userId, scopeKey) always resolves to the same row. */
function lastSeenId(userId: string, scopeKey: string): string {
  return `lastseen::${userId}::${scopeKey}`;
}

/**
 * How stale local lastSeen must be before we bother pushing the new value to
 * Sheets. UI re-polls activity on every dashboard render — without throttling
 * we'd flood the Apps Script LockService and serialize behind every save.
 *
 * 5 minutes is plenty: the only thing lastSeen drives is the "new since last
 * visit" dot — even if Sheets lags by 5 min, users barely notice. Local Prisma
 * is updated synchronously every time, so within a single lambda the value is
 * always fresh.
 */
const LASTSEEN_SHEETS_PUSH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * GET /api/activity?scopeKey=...&userId=...
 * Returns activity entries since user's last visit, and updates lastSeen.
 */
export async function GET(request: Request) {
  try {
    await ensureCacheFresh();

    const url = new URL(request.url);
    const scopeKey = url.searchParams.get('scopeKey') || '';
    const userId = url.searchParams.get('userId') || '';

    if (!scopeKey || !userId) {
      return NextResponse.json({ ok: false, error: 'scopeKey and userId are required.' }, { status: 400 });
    }

    const lastSeenRecord = await prisma.userLastSeen.findUnique({
      where: { userId_scopeKey: { userId, scopeKey } },
    });

    const lastSeenAt = lastSeenRecord?.lastSeenAt ?? new Date(0);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);

    const entries = await prisma.activityEntry.findMany({
      where: {
        scopeKey,
        createdAt: { gte: cutoff },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const newCount = entries.filter((entry) => entry.createdAt > lastSeenAt).length;

    const now = nowIso();
    const nowDate = new Date(now);
    const id = lastSeenId(userId, scopeKey);
    const record = { id, userId, scopeKey, lastSeenAt: now };

    // Local SQLite update — always synchronous, cheap, gives the user a
    // consistent newCount within this lambda.
    await prisma.userLastSeen.upsert({
      where: { id },
      update: { lastSeenAt: nowDate },
      create: { ...record, lastSeenAt: nowDate },
    });

    // Sheets push throttle: every dashboard render hits this endpoint many
    // times (once per metric note thread). Pushing every call serialized
    // dozens of writes behind every save in Apps Script's LockService.
    //
    // Only push when local lastSeen is older than the interval. The Prisma
    // upsert above already updated local state, so this is purely about
    // keeping Sheets eventually consistent for cross-lambda visibility.
    const previousLastSeen = lastSeenRecord?.lastSeenAt?.getTime() ?? 0;
    const shouldPush = nowDate.getTime() - previousLastSeen >= LASTSEEN_SHEETS_PUSH_INTERVAL_MS;

    if (shouldPush) {
      // Fire-and-forget: the response doesn't wait for Sheets. If the push
      // fails the next call (5+ min from now) retries it.
      void (async () => {
        try {
          await pushUpdate('UserLastSeen', record);
        } catch {
          try {
            await pushNew('UserLastSeen', record);
          } catch (err) {
            logger.warn({ err, id }, 'background UserLastSeen push failed');
          }
        }
      })();
    }

    return NextResponse.json({
      ok: true,
      entries,
      lastSeenAt: lastSeenAt.toISOString(),
      newCount,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Nepodarilo sa načítať aktivitu.' }, { status: 500 });
  }
}
