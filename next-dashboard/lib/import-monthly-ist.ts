import Papa from 'papaparse';
import * as XLSX from 'xlsx';

import { resolveMonthLabel } from '@/lib/months';

export type ImportSource = 'PLAN' | 'IST' | 'VOD';

export type ParsedMonthlyValue = {
  storeId: string;
  storeName: string;
  metricCode: string;
  metricName: string;
  monthId: string;
  monthLabel: string;
  year: number;
  monthNumber: number;
  businessYear: number;
  businessOrder: number;
  value: number;
  present: boolean;
};

export type ParsedImportDataset = {
  values: ParsedMonthlyValue[];
  sheetName: string;
};

const KNOWN_METRICS: Record<string, { displayName: string; unit: string; aggregation: string }> = {
  'obrat gj2026': { displayName: 'Obrat GJ2026', unit: 'currency', aggregation: 'sum' },
  'hodiny netto': { displayName: 'Hodiny netto', unit: 'hours', aggregation: 'sum' },
  'hodiny netto plan vt': { displayName: 'Hodiny netto Plan VT', unit: 'hours', aggregation: 'sum' },
  'cisty vykon': { displayName: 'Čistý výkon', unit: 'number', aggregation: 'ratio' },
  'cistý vykon': { displayName: 'Čistý výkon', unit: 'number', aggregation: 'ratio' },
  'struktura hodin': { displayName: 'Štruktúra hodín', unit: 'hours', aggregation: 'sum' },
  'struktura filialky (plne uvazky)': { displayName: 'Štruktúra filiálky (plné úväzky)', unit: 'fte', aggregation: 'sum' },
};

function normalizeText(value: string) {
  return value
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
    .replace(/\s+/g, ' ');
}

function metricCodeFromName(metricName: string) {
  return normalizeText(metricName)
    .replace(/[^a-z0-9+ ]/g, '')
    .replace(/\s+/g, '-');
}

function parseNumber(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return { value: 0, present: false };
  }

  const normalized = raw
    .replace(/\s+/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  const parsed = Number(normalized);
  return {
    value: Number.isFinite(parsed) ? parsed : 0,
    present: Number.isFinite(parsed),
  };
}

function normalizeImportedMetricValue(metric: { unit: string | null; displayName: string }, value: number) {
  const numeric = Number(value || 0);
  if (metric.unit === 'currency' && Number.isInteger(numeric) && Math.abs(numeric) >= 100000000) {
    return numeric / 1000;
  }
  return numeric;
}

function decodeFile(buffer: Buffer) {
  if (buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.slice(2).toString('utf16le');
  }

  let zeroCount = 0;
  for (let index = 0; index < Math.min(buffer.length, 512); index += 1) {
    if (buffer[index] === 0) {
      zeroCount += 1;
    }
  }

  if (zeroCount > 32) {
    return buffer.toString('utf16le');
  }

  return buffer.toString('utf8').replace(/^\ufeff/, '');
}

function parseRows(text: string) {
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
  });

  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message || 'Nepodarilo sa parsovať CSV súbor.');
  }

  return parsed.data;
}

function normalizeCellValue(value: unknown) {
  if (value == null) {
    return '';
  }

  return String(value).trim();
}

function parseWorkbookRows(buffer: Buffer, preferredSheetName?: string) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const availableSheets = workbook.SheetNames || [];
  if (!availableSheets.length) {
    throw new Error('Excel súbor neobsahuje žiadny sheet.');
  }

  const requestedSheetName = String(preferredSheetName || '').trim();
  const targetSheetName = requestedSheetName || availableSheets[0];
  const worksheet = workbook.Sheets[targetSheetName];
  if (!worksheet) {
    throw new Error(`Sheet ${targetSheetName} sa v Excel súbore nenašiel.`);
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
    header: 1,
    blankrows: false,
    raw: false,
    defval: '',
  }).map((row) => row.map((cell) => normalizeCellValue(cell)));

  return {
    rows: rows.filter((row) => row.some((cell) => String(cell || '').trim() !== '')),
    sheetName: targetSheetName,
  };
}

function parseDelimitedRows(buffer: Buffer) {
  const text = decodeFile(buffer);
  return {
    rows: parseRows(text).filter((row) => row.some((cell) => String(cell ?? '').trim() !== '')),
    sheetName: 'CSV',
  };
}

export function getMetricMetadata(metricName: string) {
  const normalized = normalizeText(metricName);
  const known = KNOWN_METRICS[normalized];
  return {
    code: metricCodeFromName(metricName),
    displayName: known?.displayName || metricName.trim(),
    unit: known?.unit || null,
    aggregation: known?.aggregation || 'sum',
  };
}

export function parseWideTableImport(buffer: Buffer, options?: { fileName?: string; preferredSheetName?: string }): ParsedImportDataset {
  const fileName = String(options?.fileName || '').toLowerCase();
  const parsedInput = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
    ? parseWorkbookRows(buffer, options?.preferredSheetName)
    : parseDelimitedRows(buffer);
  const rows = parsedInput.rows;

  if (rows.length < 2) {
    throw new Error('Importovaný súbor nemá dostatok dát.');
  }

  const header = rows[0].map((cell) => String(cell ?? '').trim());
  if (header.length < 4) {
    throw new Error('Súbor musí mať aspoň 4 stĺpce: Store ID, Store Name, Metric, mesiace.');
  }

  const monthColumns = header.slice(3).map((monthLabel, index) => ({
    index: index + 3,
    month: resolveMonthLabel(monthLabel),
  }));

  const values: ParsedMonthlyValue[] = [];
  let currentStoreId = '';
  let currentStoreName = '';

  for (const row of rows.slice(1)) {
    const rowStoreId = String(row[0] ?? '').trim();
    const rowStoreName = String(row[1] ?? '').trim();
    const rawMetric = String(row[2] ?? '').trim();

    if (rowStoreId) {
      currentStoreId = rowStoreId;
    }
    if (rowStoreName) {
      currentStoreName = rowStoreName;
    }

    if (!currentStoreId || !rawMetric) {
      continue;
    }

    const metric = getMetricMetadata(rawMetric);

    for (const monthColumn of monthColumns) {
      const parsedValue = parseNumber(row[monthColumn.index]);
      if (!parsedValue.present) {
        continue;
      }

      values.push({
        storeId: currentStoreId,
        storeName: currentStoreName || currentStoreId,
        metricCode: metric.code,
        metricName: metric.displayName,
        monthId: monthColumn.month.id,
        monthLabel: monthColumn.month.label,
        year: monthColumn.month.year,
        monthNumber: monthColumn.month.monthNumber,
        businessYear: monthColumn.month.businessYear,
        businessOrder: monthColumn.month.businessOrder,
        value: normalizeImportedMetricValue(metric, parsedValue.value),
        present: true,
      });
    }
  }

  return {
    values,
    sheetName: parsedInput.sheetName,
  };
}

export function parseMonthlyIstFile(buffer: Buffer, options?: { fileName?: string; preferredSheetName?: string }) {
  return parseWideTableImport(buffer, options).values;
}
