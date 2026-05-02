import { NextResponse } from 'next/server';

import { requireAdminSecret } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    const createPayload: Array<{
      source: string;
      storeId: string;
      metricCode: string;
      monthId: string;
      value: number;
      present: true;
      importedAt: Date;
    }> = [];

    for (const row of normalizedRows) {
      await prisma.metric.upsert({
        where: { code: row.metricCode },
        update: { displayName: row.metricName },
        create: {
          code: row.metricCode,
          displayName: row.metricName,
          aggregation: 'sum',
        },
      });

      for (const [monthId, rawValue] of row.values) {
        const value = parseOptionalNumber(rawValue);
        if (value == null) {
          continue;
        }
        createPayload.push({
          source,
          storeId,
          metricCode: row.metricCode,
          monthId,
          value,
          present: true,
          importedAt: new Date(),
        });
      }
    }

    await prisma.monthlyValue.deleteMany({
      where: { source, storeId },
    });

    if (createPayload.length) {
      await prisma.monthlyValue.createMany({
        data: createPayload,
      });
    }

    return NextResponse.json({
      ok: true,
      rowsSaved: normalizedRows.length,
      valuesSaved: createPayload.length,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Uloženie mesačných dát zlyhalo.' }, { status: 500 });
  }
}