import { NextResponse } from 'next/server';

import { requireAdminSecret } from '@/lib/auth';
import { ensureCacheFresh } from '@/lib/db/client';
import { parseWideTableImport, getMetricMetadata } from '@/lib/import-monthly-ist';
import { prisma } from '@/lib/prisma';
import { newId, nowIso, pushBulkReplaceSlice, pushNew } from '@/lib/sheets/write-through';

const PLAN_SHEET_NAME = 'PLANGJ2026';

export async function POST(request: Request) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;
  try {
    await ensureCacheFresh();
    const formData = await request.formData();
    const file = formData.get('file');
    const uploadedBy = String(formData.get('uploadedBy') || '').trim() || null;
    const source = 'PLAN' as const;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Chýba importovaný súbor.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const parsedImport = parseWideTableImport(Buffer.from(arrayBuffer), {
      fileName: file.name,
      preferredSheetName: PLAN_SHEET_NAME,
    });

    // PLAN: import all months of the business year (no current-month cap)
    const dedupedMap = new Map<string, typeof parsedImport.values[number]>();
    for (const value of parsedImport.values) {
      dedupedMap.set(`${value.storeId}::${value.metricCode}::${value.monthId}`, value);
    }
    const values = Array.from(dedupedMap.values());

    if (!values.length) {
      return NextResponse.json({ error: `V súbore ${PLAN_SHEET_NAME} sa nenašli žiadne hodnoty.` }, { status: 400 });
    }

    const distinctStores = new Map<string, { id: string; name: string }>();
    const distinctMonths = new Map<string, { id: string; label: string; year: number; monthNumber: number; businessYear: number; businessOrder: number }>();
    const distinctMetrics = new Map<string, { code: string; displayName: string; unit: string | null; aggregation: string }>();

    for (const value of values) {
      distinctStores.set(value.storeId, { id: value.storeId, name: value.storeName });
      distinctMonths.set(value.monthId, {
        id: value.monthId,
        label: value.monthLabel,
        year: value.year,
        monthNumber: value.monthNumber,
        businessYear: value.businessYear,
        businessOrder: value.businessOrder,
      });
      const metric = getMetricMetadata(value.metricName);
      distinctMetrics.set(metric.code, metric);
    }

    const now = nowIso();
    const importedStoreIds = Array.from(distinctStores.keys());
    const importedMonthIds = new Set(distinctMonths.keys());

    // STORES — bulk replace in Sheets, but upsert in cache (FK refs from MonthlyValue)
    {
      const existing = await prisma.store.findMany({ where: { id: { in: importedStoreIds } } });
      const existingById = new Map(existing.map(e => [e.id, e]));
      const records = Array.from(distinctStores.values()).map(s => {
        const ex = existingById.get(s.id);
        return {
          id: s.id,
          name: s.name,
          gfName: ex?.gfName ?? null,
          vklName: ex?.vklName ?? null,
          createdAt: ex ? ex.createdAt.toISOString() : now,
          updatedAt: now,
        };
      });
      const importedIdSet = new Set(importedStoreIds);
      await pushBulkReplaceSlice('Store', (r) => importedIdSet.has(String(r.id)), records);
      for (const r of records) {
        await prisma.store.upsert({
          where: { id: r.id },
          update: { name: r.name, updatedAt: new Date(now) },
          create: { ...r, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) },
        });
      }
    }

    // MONTHS — bulk replace in Sheets, upsert in cache
    {
      const existing = await prisma.month.findMany({ where: { id: { in: [...importedMonthIds] } } });
      const existingById = new Map(existing.map(e => [e.id, e]));
      const records = Array.from(distinctMonths.values()).map(m => {
        const ex = existingById.get(m.id);
        return {
          ...m,
          createdAt: ex ? ex.createdAt.toISOString() : now,
          updatedAt: now,
        };
      });
      await pushBulkReplaceSlice('Month', (r) => importedMonthIds.has(String(r.id)), records);
      for (const r of records) {
        await prisma.month.upsert({
          where: { id: r.id },
          update: {
            label: r.label, year: r.year, monthNumber: r.monthNumber,
            businessYear: r.businessYear, businessOrder: r.businessOrder,
            updatedAt: new Date(now),
          },
          create: { ...r, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) },
        });
      }
    }

    // METRICS — bulk replace in Sheets, upsert in cache
    {
      const importedCodes = [...distinctMetrics.keys()];
      const existing = await prisma.metric.findMany({ where: { code: { in: importedCodes } } });
      const existingByCode = new Map(existing.map(e => [e.code, e]));
      const records = Array.from(distinctMetrics.values()).map(m => {
        const ex = existingByCode.get(m.code);
        return {
          code: m.code,
          displayName: m.displayName,
          unit: m.unit,
          aggregation: m.aggregation,
          createdAt: ex ? ex.createdAt.toISOString() : now,
          updatedAt: now,
        };
      });
      const codeSet = new Set(importedCodes);
      await pushBulkReplaceSlice('Metric', (r) => codeSet.has(String(r.code)), records);
      for (const r of records) {
        await prisma.metric.upsert({
          where: { code: r.code },
          update: { displayName: r.displayName, unit: r.unit, aggregation: r.aggregation, updatedAt: new Date(now) },
          create: { ...r, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) },
        });
      }
    }

    // IMPORT BATCH
    const batchRecord = {
      id: newId(),
      source,
      fileName: file.name,
      uploadedBy: uploadedBy ?? null,
      status: 'completed',
      rowCount: values.length,
      monthId: null,
      createdAt: now,
    };
    await pushNew('ImportBatch', batchRecord);
    const batch = await prisma.importBatch.create({
      data: { ...batchRecord, createdAt: new Date(now) },
    });

    // MONTHLY VALUES — for PLAN, wipe and re-insert ALL plan rows for these stores+months
    const importedStoreIdSet = new Set(importedStoreIds);
    const monthIdSet = importedMonthIds;

    const newMvRecords = values.map(v => ({
      id: newId(),
      source,
      storeId: v.storeId,
      metricCode: v.metricCode,
      monthId: v.monthId,
      value: v.value,
      present: v.present,
      importedAt: now,
      importBatchId: batch.id,
      createdAt: now,
      updatedAt: now,
    }));

    await pushBulkReplaceSlice(
      'MonthlyValue',
      (r) => r.source === source
        && importedStoreIdSet.has(String(r.storeId))
        && monthIdSet.has(String(r.monthId)),
      newMvRecords,
    );
    await prisma.monthlyValue.deleteMany({
      where: {
        source,
        storeId: { in: importedStoreIds },
        monthId: { in: [...monthIdSet] },
      },
    });
    await prisma.monthlyValue.createMany({
      data: newMvRecords.map(r => ({
        ...r,
        importedAt: new Date(r.importedAt),
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      })),
    });

    return NextResponse.json({
      ok: true,
      source,
      sheetName: parsedImport.sheetName,
      fileName: file.name,
      rowCount: values.length,
      stores: distinctStores.size,
      months: distinctMonths.size,
      metrics: distinctMetrics.size,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PLAN import zlyhal.' },
      { status: 500 },
    );
  }
}
