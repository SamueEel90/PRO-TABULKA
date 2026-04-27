import { NextResponse } from 'next/server';

import { parseWideTableImport, getMetricMetadata } from '@/lib/import-monthly-ist';
import { resolveMonthLabel } from '@/lib/months';
import { prisma } from '@/lib/prisma';

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
    const values = filterMeaningfulIstValues(parsedImport.values.filter((value) => (
      value.businessYear === currentBusinessMonth.businessYear
      && value.businessOrder <= currentBusinessMonth.businessOrder
    )));

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

    for (const store of distinctStores.values()) {
      await prisma.store.upsert({
        where: { id: store.id },
        update: { name: store.name },
        create: { id: store.id, name: store.name },
      });
    }

    for (const month of distinctMonths.values()) {
      await prisma.month.upsert({
        where: { id: month.id },
        update: {
          label: month.label,
          year: month.year,
          monthNumber: month.monthNumber,
          businessYear: month.businessYear,
          businessOrder: month.businessOrder,
        },
        create: month,
      });
    }

    for (const metric of distinctMetrics.values()) {
      await prisma.metric.upsert({
        where: { code: metric.code },
        update: {
          displayName: metric.displayName,
          unit: metric.unit,
          aggregation: metric.aggregation,
        },
        create: metric,
      });
    }

    const importedStoreIds = Array.from(distinctStores.keys());

    if (importedStoreIds.length) {
      await prisma.monthlyValue.deleteMany({
        where: {
          source,
          storeId: { in: importedStoreIds },
          month: {
            businessYear: currentBusinessMonth.businessYear,
            businessOrder: { lte: currentBusinessMonth.businessOrder },
          },
        },
      });
    }

    const batch = await prisma.importBatch.create({
      data: {
        source,
        fileName: file.name,
        uploadedBy,
        rowCount: values.length,
      },
    });

    for (const value of values) {
      await prisma.monthlyValue.create({
        data: {
          source,
          storeId: value.storeId,
          metricCode: value.metricCode,
          monthId: value.monthId,
          value: value.value,
          present: value.present,
          importBatchId: batch.id,
        },
      });
    }

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
