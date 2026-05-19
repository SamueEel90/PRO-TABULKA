import { NextResponse } from 'next/server';

import { ensureCacheFresh } from '@/lib/db/client';
import { prisma } from '@/lib/prisma';
import { nowIso, pushNew, pushUpdate } from '@/lib/sheets/write-through';

/** Deterministic id so the same (userId, scopeKey) always resolves to the same row. */
function lastSeenId(userId: string, scopeKey: string): string {
  return `lastseen::${userId}::${scopeKey}`;
}

/**
 * GET /api/activity?scopeKey=...&userId=...
 * Returns activity entries since user's last visit, and updates lastSeen.
 */
export async function GET(request: Request) {
  try {
    await ensureCacheFresh({ force: true });

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

    // Upsert lastSeen with a deterministic id so concurrent requests can't
    // create duplicates. Try update first; if the row doesn't exist in Sheets,
    // fall back to insert.
    const now = nowIso();
    const id = lastSeenId(userId, scopeKey);
    const record = { id, userId, scopeKey, lastSeenAt: now };
    try {
      await pushUpdate('UserLastSeen', record);
    } catch {
      await pushNew('UserLastSeen', record);
    }
    await prisma.userLastSeen.upsert({
      where: { id },
      update: { lastSeenAt: new Date(now) },
      create: { ...record, lastSeenAt: new Date(now) },
    });

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
