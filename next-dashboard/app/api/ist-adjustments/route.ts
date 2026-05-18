import { NextResponse } from 'next/server';

import { ensureCacheFresh } from '@/lib/db/client';
import { prisma } from '@/lib/prisma';
import { getUserFromHeaders } from '@/lib/auth/session';
import { newId, nowIso, pushNew } from '@/lib/sheets/write-through';

function slugifyMetricLabel(label: string) {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9+ ]/g, '')
    .replace(/\s+/g, '-');
}

async function resolveMetricCode(label: string): Promise<string | null> {
  const trimmed = String(label || '').trim();
  if (!trimmed) return null;
  const byCode = await prisma.metric.findUnique({ where: { code: trimmed } });
  if (byCode) return byCode.code;
  const byName = await prisma.metric.findFirst({ where: { displayName: trimmed } });
  if (byName) return byName.code;
  const slug = slugifyMetricLabel(trimmed);
  if (slug) {
    const bySlug = await prisma.metric.findUnique({ where: { code: slug } });
    if (bySlug) return bySlug.code;
  }
  const fuzzy = await prisma.metric.findFirst({
    where: { displayName: { startsWith: trimmed } },
    orderBy: { displayName: 'asc' },
  });
  return fuzzy?.code ?? null;
}

/**
 * GET /api/ist-adjustments
 *   ?storeId=...           — list requests for that store (VOD's own scope, or VKL viewing the store)
 *   ?vklName=...           — list pending requests across all stores under that VKL
 *   ?status=pending|approved|rejected|all (default: all)
 *   ?storeId=...&metricCode=...&listIstMonths=1
 *      — special mode: returns months that have IST values for that store+metric
 *        so the VOD modal can populate its month dropdown
 */
export async function GET(request: Request) {
  try {
    await ensureCacheFresh();
    const user = getUserFromHeaders(request.headers);
    const url = new URL(request.url);
    const storeId = url.searchParams.get('storeId') || '';
    const vklName = url.searchParams.get('vklName') || '';
    const metricCode = url.searchParams.get('metricCode') || '';
    const listIstMonths = url.searchParams.get('listIstMonths') === '1';
    const status = url.searchParams.get('status') || 'all';

    if (listIstMonths) {
      if (!storeId || !metricCode) {
        return NextResponse.json({ ok: false, error: 'storeId a metricCode sú povinné.' }, { status: 400 });
      }
      const resolvedCode = await resolveMetricCode(metricCode);
      if (!resolvedCode) {
        return NextResponse.json({ ok: true, months: [], resolvedMetricCode: null });
      }
      const rows = await prisma.monthlyValue.findMany({
        where: { storeId, metricCode: resolvedCode, source: 'IST', present: true },
        select: { monthId: true, value: true, month: { select: { label: true, businessYear: true, businessOrder: true } } },
        orderBy: [{ month: { businessYear: 'desc' } }, { month: { businessOrder: 'desc' } }],
      });
      const months = rows.map((r) => ({ id: r.monthId, label: r.month.label, value: r.value }));
      return NextResponse.json({ ok: true, months, resolvedMetricCode: resolvedCode });
    }

    const where: { storeId?: string; vklName?: string; status?: string } = {};
    if (storeId) where.storeId = storeId;
    if (vklName) where.vklName = vklName;
    if (status !== 'all') where.status = status;

    if (!where.storeId && !where.vklName) {
      // Sensible default per role
      if (user.role === 'VOD' && user.primaryStoreId) where.storeId = user.primaryStoreId;
      else if (user.role === 'VKL' && user.vklName) where.vklName = user.vklName;
    }

    const requests = await prisma.istAdjustmentRequest.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { store: { select: { id: true, name: true, vklName: true, gfName: true } } },
    });

    const counts = {
      pending: requests.filter((r) => r.status === 'pending').length,
      approved: requests.filter((r) => r.status === 'approved').length,
      rejected: requests.filter((r) => r.status === 'rejected').length,
      total: requests.length,
    };

    return NextResponse.json({ ok: true, requests, counts });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Nepodarilo sa načítať žiadosti.' },
      { status },
    );
  }
}

/**
 * POST /api/ist-adjustments
 * Body: { metricCode, monthId, newValue, reason }
 * Only VOD can create. storeId is taken from user.primaryStoreId.
 */
export async function POST(request: Request) {
  try {
    await ensureCacheFresh();
    const user = getUserFromHeaders(request.headers);
    if (user.role !== 'VOD') {
      return NextResponse.json({ ok: false, error: 'Iba VOD môže žiadať o úpravu IST.' }, { status: 403 });
    }
    if (!user.primaryStoreId) {
      return NextResponse.json({ ok: false, error: 'Používateľ nemá priradenú filiálku.' }, { status: 400 });
    }

    const body = await request.json() as {
      metricCode?: string;
      monthId?: string;
      newValue?: number;
      reason?: string;
    };
    const { metricCode, monthId, reason } = body;
    const newValue = Number(body.newValue);

    if (!metricCode || !monthId || !reason || Number.isNaN(newValue)) {
      return NextResponse.json({ ok: false, error: 'metricCode, monthId, newValue, reason sú povinné.' }, { status: 400 });
    }
    const trimmedReason = String(reason).trim();
    if (trimmedReason.length < 3) {
      return NextResponse.json({ ok: false, error: 'Odôvodnenie je príliš krátke.' }, { status: 400 });
    }

    const resolvedCode = await resolveMetricCode(metricCode);
    if (!resolvedCode) {
      return NextResponse.json({ ok: false, error: 'Metrika sa nenašla v databáze.' }, { status: 404 });
    }

    // Read current IST value (must exist)
    const current = await prisma.monthlyValue.findUnique({
      where: { source_storeId_metricCode_monthId: { source: 'IST', storeId: user.primaryStoreId, metricCode: resolvedCode, monthId } },
      include: { month: { select: { label: true } } },
    });
    if (!current) {
      return NextResponse.json({ ok: false, error: 'Pre tento mesiac nie je IST hodnota.' }, { status: 404 });
    }

    const store = await prisma.store.findUnique({ where: { id: user.primaryStoreId }, select: { vklName: true } });

    const now = nowIso();
    const requestRecord = {
      id: newId(),
      storeId: user.primaryStoreId,
      metricCode: resolvedCode,
      monthId,
      monthLabel: current.month.label,
      oldValue: current.value,
      newValue,
      reason: trimmedReason,
      status: 'pending',
      requestedById: user.id,
      requestedByName: user.email,
      vklName: store?.vklName ?? null,
      decidedAt: null,
      decidedById: null,
      decidedByName: null,
      decisionNote: null,
      createdAt: now,
      updatedAt: now,
    };
    await pushNew('IstAdjustmentRequest', requestRecord);
    const created = await prisma.istAdjustmentRequest.create({
      data: {
        ...requestRecord,
        createdAt: new Date(now),
        updatedAt: new Date(now),
        decidedAt: null,
      },
    });

    try {
      const activityRecord = {
        id: newId(),
        scopeKey: `STORE|${user.primaryStoreId}`,
        actorRole: 'VOD',
        actorName: user.email,
        action: 'ist-adjust-requested',
        metricKey: resolvedCode,
        monthLabel: current.month.label,
        detail: `${current.value} → ${newValue} · ${trimmedReason.slice(0, 160)}`,
        createdAt: now,
      };
      await pushNew('ActivityEntry', activityRecord);
      await prisma.activityEntry.create({
        data: { ...activityRecord, createdAt: new Date(now) },
      });
    } catch {
      /* best effort */
    }

    return NextResponse.json({ ok: true, request: created });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Nepodarilo sa vytvoriť žiadosť.' },
      { status },
    );
  }
}
