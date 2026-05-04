import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

/**
 * GET /api/activity?scopeKey=...&userId=...
 * Returns activity entries since user's last visit, and updates lastSeen.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scopeKey = url.searchParams.get('scopeKey') || '';
    const userId = url.searchParams.get('userId') || '';

    if (!scopeKey || !userId) {
      return NextResponse.json({ ok: false, error: 'scopeKey and userId are required.' }, { status: 400 });
    }

    // Find last seen timestamp for this user+scope
    const lastSeenRecord = await prisma.userLastSeen.findUnique({
      where: { userId_scopeKey: { userId, scopeKey } },
    });

    const lastSeenAt = lastSeenRecord?.lastSeenAt ?? new Date(0);

    // Fetch all recent entries (last 14 days, max 50) — always show recent activity
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

    // Count how many are "new" since last visit (for the badge)
    const newCount = entries.filter((entry) => entry.createdAt > lastSeenAt).length;

    // Update lastSeen to now (so new badge resets after viewing)
    await prisma.userLastSeen.upsert({
      where: { userId_scopeKey: { userId, scopeKey } },
      update: { lastSeenAt: new Date() },
      create: { userId, scopeKey, lastSeenAt: new Date() },
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
