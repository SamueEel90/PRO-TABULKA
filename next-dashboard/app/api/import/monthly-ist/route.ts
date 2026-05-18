import { NextResponse } from 'next/server';

import { ensureCacheFresh } from '@/lib/db/client';
import { parseWideTableImport, getMetricMetadata } from '@/lib/import-monthly-ist';
import { resolveMonthLabel } from '@/lib/months';
import { prisma } from '@/lib/prisma';
import { newId, nowIso, pushBulkReplaceSlice, pushNew } from '@/lib/sheets/write-through';

const IST_SHEET_NAME = 'ISTGJ2026';

function filterMeaningfulIstValues<T extends { storeId: string; monthId: string; value: number }>(values: T[]) {
  const groups = new Map<string, { hasNonZeroValue: boolean; values: T[] }>();

  values.forEach((value) => {
    const key = `${value.storeId}::${value.monthId}`;
    const existing = groups.get(key) || { hasNonZeroValue: false, values: [] };
    existing.values.push(value);
    if (Math.abs(Number(value.value || 0)) > 0.0001) {
      existing.hasNonZeroValue = true;
    }
    groups.set(key, existing);
  });

  return Array.from(groups.values()).flatMap((group) => (group.hasNonZeroValue ? group.values : []));
}

function getCurrentBusinessMonth() {
  const now = new Date();
  const skMonthNames = [
    'január',
    'február',
    'marec',
    'apríl',
    'máj',
    'jún',
    'júl',
    'august',
    'september',
    'október',
    'november',
    'december',
  ];

  return resolveMonthLabel(`${skMonthNames[now.getMonth()]} ${now.getFullYear()}`);
}

export async function POST(request: Request) {
  try {
    await ensureCacheFresh();
    const formData = await request.formData();
    const file = formData.get('file');
    const uploadedBy = String(formData.get('uploadedBy') || '').trim() || null;
    const source = 'IST' as const;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Chýba importovaný súbor.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const parsedImport = parseWideTableImport(Buffer.from(arrayBuffer), {
      fileName: file.name,
      preferredSheetName: IST_SHEET_NAME,
    });
    const currentBusinessMonth = getCurrentBusinessMonth();
    const filteredValues = filterMeaningfulIstValues(parsedImport.values.filter((value) => (
      value.businessYear === currentBusinessMonth.businessYear
      && value.businessOrder <= currentBusinessMonth.businessOrder
    )));

    const dedupedMap = new Map<string, typeof filteredValues[number]>();
    for (const value of filteredValues) {
      dedupedMap.set(`${value.storeId}::${value.metricCode}::${value.monthId}`, value);
    }

    const STRUCTURE_HOURS_CODE = 'struktura-hodin';
    const WORKING_DAYS_CODE = 'pracovne-dni-zamestnancov';
    const TIER_HOURS_PER_DAY: Record<string, number> = {
      'struktura-filialky-100': 7.75,
      'struktura-filialky-90': 7,
      'struktura-filialky-77': 6,
      'struktura-filialky-65': 5,
      'struktura-filialky-52': 4,
      'struktura-filialky-39': 3,
    };

    const groupKey = (storeId: string, monthId: string) => `${storeId}::${monthId}`;
    const groups = new Map<string, { storeId: string; monthId: string; sample: typeof filteredValues[number]; workingDays: number; tierHours: number }>();
    for (const value of dedupedMap.values()) {
      const key = groupKey(value.storeId, value.monthId);
      const existing = groups.get(key) || { storeId: value.storeId, monthId: value.monthId, sample: value, workingDays: 0, tierHours: 0 };
      if (value.metricCode === WORKING_DAYS_CODE) {
        existing.workingDays = value.value;
      } else if (TIER_HOURS_PER_DAY[value.metricCode] !== undefined) {
        existing.tierHours += value.value * TIER_HOURS_PER_DAY[value.metricCode];
      }
      groups.set(key, existing);
    }

    for (const group of groups.values()) {
      if (group.workingDays <= 0 || group.tierHours <= 0) continue;
      const computed = group.workingDays * group.tierHours;
      const key = `${group.storeId}::${STRUCTURE_HOURS_CODE}::${group.monthId}`;
      const existing = dedupedMap.get(key);
      if (existing && Math.abs(existing.value) > 0.0001) continue;
      dedupedMap.set(key, {
        ...group.sample,
        metricCode: STRUCTURE_HOURS_CODE,
        metricName: 'Štruktúra hodín',
        value: computed,
        present: true,
      });
    }

    const values = Array.from(dedupedMap.values());

    if (!values.length) {
      return NextResponse.json({ error: `V súbore ${IST_SHEET_NAME} sa nenašli žiadne IST hodnoty do aktuálneho mesiaca ${currentBusinessMonth.label}.` }, { status: 400 });
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

    // STORES — bulk replace in Sheets, upsert in cache (FK refs prevent delete)
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

    // IMPORT BATCH — single insert
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

    // MONTHLY VALUES — load existing range from cache to determine slice; replace.
    const replaceableMonthIds = new Set(
      (await prisma.month.findMany({
        where: {
          businessYear: currentBusinessMonth.businessYear,
          businessOrder: { lte: currentBusinessMonth.businessOrder },
        },
        select: { id: true },
      })).map(m => m.id),
    );
    const importedStoreIdSet = new Set(importedStoreIds);

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
        && replaceableMonthIds.has(String(r.monthId)),
      newMvRecords,
    );
    await prisma.monthlyValue.deleteMany({
      where: {
        source,
        storeId: { in: importedStoreIds },
        monthId: { in: [...replaceableMonthIds] },
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
      importedMonthRange: `marec ${currentBusinessMonth.businessYear} až ${currentBusinessMonth.label}`,
      rowCount: values.length,
      stores: distinctStores.size,
      months: distinctMonths.size,
      metrics: distinctMetrics.size,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Import zlyhal.',
      },
      { status: 500 },
    );
  }
}
