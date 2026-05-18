import { NextResponse } from 'next/server';

import { requireAdminSecret } from '@/lib/auth';
import { ensureCacheFresh } from '@/lib/db/client';
import { prisma } from '@/lib/prisma';
import { newId, nowIso, pushBulkReplaceSlice, pushNew, pushUpdate } from '@/lib/sheets/write-through';

const ALLOWED_SOURCES = new Set(['PLAN', 'IST', 'VOD']);

type EditorRowInput = {
  metricCode?: string;
  metricName?: string;
  values?: Record<string, number | string | null | undefined>;
};

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function normalizeMetricCode(metricName: string) {
  return metricName
    .trim()
    .toLowerCase()
    .replace(/[áä]/g, 'a')
    .replace(/[č]/g, 'c')
    .replace(/[ď]/g, 'd')
    .replace(/[éě]/g, 'e')
    .replace(/[í]/g, 'i')
    .replace(/[ĺľ]/g, 'l')
    .replace(/[ň]/g, 'n')
    .replace(/[óô]/g, 'o')
    .replace(/[ŕř]/g, 'r')
    .replace(/[š]/g, 's')
    .replace(/[ť]/g, 't')
    .replace(/[úů]/g, 'u')
    .replace(/[ý]/g, 'y')
    .replace(/[ž]/g, 'z')
    .replace(/>/g, '+')
    .replace(/[^a-z0-9+ ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function parseOptionalNumber(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }

  const normalized = raw
    .replace(/\s+/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getValidatedSource(value: string | null) {
  const source = normalizeText(value).toUpperCase();
  if (!ALLOWED_SOURCES.has(source)) {
    return null;
  }
  return source;
}

export async function GET(request: Request) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;
  try {
    await ensureCacheFresh();
    const { searchParams } = new URL(request.url);
    const source = getValidatedSource(searchParams.get('source'));
    const storeId = normalizeText(searchParams.get('storeId'));

    if (!source) {
      return NextResponse.json({ error: 'Query parameter source musí byť PLAN, IST alebo VOD.' }, { status: 400 });
    }

    const [stores, months, values] = await Promise.all([
      prisma.store.findMany({
        orderBy: [{ gfName: 'asc' }, { vklName: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, gfName: true, vklName: true },
      }),
      prisma.month.findMany({
        orderBy: [{ businessYear: 'asc' }, { businessOrder: 'asc' }],
        select: { id: true, label: true, businessYear: true, businessOrder: true },
      }),
      storeId
        ? prisma.monthlyValue.findMany({
            where: { source, storeId },
            orderBy: [{ metric: { displayName: 'asc' } }, { month: { businessYear: 'asc' } }, { month: { businessOrder: 'asc' } }],
            include: {
              metric: { select: { code: true, displayName: true } },
              month: { select: { id: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const rowsByMetric = new Map<string, { metricCode: string; metricName: string; values: Record<string, number> }>();

    for (const value of values) {
      const metricCode = value.metric.code;
      const existing = rowsByMetric.get(metricCode) || {
        metricCode,
        metricName: value.metric.displayName,
        values: {},
      };
      existing.values[value.month.id] = Number(value.value || 0);
      rowsByMetric.set(metricCode, existing);
    }

    return NextResponse.json({
      ok: true,
      stores: stores.map((store) => ({
        id: store.id,
        name: store.name,
        gfName: store.gfName || '',
        vklName: store.vklName || '',
      })),
      months,
      rows: Array.from(rowsByMetric.values()),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Načítanie mesačných dát zlyhalo.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;
  try {
    await ensureCacheFresh();
    const payload = await request.json() as {
      source?: string;
      storeId?: string;
      rows?: EditorRowInput[];
    };

    const source = getValidatedSource(payload.source || null);
    const storeId = normalizeText(payload.storeId);
    const rows = Array.isArray(payload.rows) ? payload.rows : [];

    if (!source) {
      return NextResponse.json({ error: 'source musí byť PLAN, IST alebo VOD.' }, { status: 400 });
    }

    if (!storeId) {
      return NextResponse.json({ error: 'Chýba filiálka.' }, { status: 400 });
    }

    const [store, months] = await Promise.all([
      prisma.store.findUnique({ where: { id: storeId }, select: { id: true } }),
      prisma.month.findMany({ select: { id: true } }),
    ]);

    if (!store) {
      return NextResponse.json({ error: `Filiálka ${storeId} neexistuje.` }, { status: 404 });
    }

    const monthIds = new Set(months.map((month) => month.id));
    const normalizedRows = rows
      .map((row) => {
        const metricName = normalizeText(row.metricName);
        const metricCode = normalizeText(row.metricCode) || normalizeMetricCode(metricName);
        return {
          metricCode,
          metricName,
          values: Object.entries(row.values || {}),
        };
      })
      .filter((row) => row.metricCode && row.metricName);

    for (const row of normalizedRows) {
      for (const [monthId] of row.values) {
        if (!monthIds.has(monthId)) {
          return NextResponse.json({ error: `Neznámy mesiac ${monthId}.` }, { status: 400 });
        }
      }
    }

    const now = nowIso();

    // 1. Upsert Metric definitions (per-metric, so the count is small)
    for (const row of normalizedRows) {
      const existing = await prisma.metric.findUnique({ where: { code: row.metricCode } });
      const metricRecord = {
        code: row.metricCode,
        displayName: row.metricName,
        unit: existing?.unit ?? null,
        aggregation: existing?.aggregation ?? 'sum',
        createdAt: existing ? existing.createdAt.toISOString() : now,
        updatedAt: now,
      };
      if (existing) {
        await pushUpdate('Metric', metricRecord);
        await prisma.metric.update({
          where: { code: row.metricCode },
          data: { displayName: row.metricName, updatedAt: new Date(now) },
        });
      } else {
        await pushNew('Metric', metricRecord);
        await prisma.metric.create({
          data: { ...metricRecord, createdAt: new Date(now), updatedAt: new Date(now) },
        });
      }
    }

    // 2. Build new MonthlyValue rows
    const newRecords: Array<{
      id: string;
      source: string;
      storeId: string;
      metricCode: string;
      monthId: string;
      value: number;
      present: boolean;
      importedAt: string;
      importBatchId: string | null;
      createdAt: string;
      updatedAt: string;
    }> = [];

    for (const row of normalizedRows) {
      for (const [monthId, rawValue] of row.values) {
        const value = parseOptionalNumber(rawValue);
        if (value == null) continue;
        newRecords.push({
          id: newId(),
          source,
          storeId,
          metricCode: row.metricCode,
          monthId,
          value,
          present: true,
          importedAt: now,
          importBatchId: null,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 3. Replace the (source, storeId) slice in Sheets in one round-trip
    await pushBulkReplaceSlice(
      'MonthlyValue',
      (r) => r.source === source && r.storeId === storeId,
      newRecords,
    );

    // 4. Mirror into local cache
    await prisma.monthlyValue.deleteMany({ where: { source, storeId } });
    if (newRecords.length) {
      await prisma.monthlyValue.createMany({
        data: newRecords.map(r => ({
          ...r,
          importedAt: new Date(r.importedAt),
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        })),
      });
    }

    const createPayload = newRecords;

    return NextResponse.json({
      ok: true,
      rowsSaved: normalizedRows.length,
      valuesSaved: createPayload.length,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Uloženie mesačných dát zlyhalo.' }, { status: 500 });
  }
}