import { readFile } from 'node:fs/promises';
import path from 'node:path';

import Papa from 'papaparse';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const DEFAULT_SHEET_NAME = 'ISTGJ2026';
const CHUNK_SIZE = 500;

const KNOWN_METRICS = {
  'obrat gj2026': { displayName: 'Obrat GJ2026', unit: 'currency', aggregation: 'sum' },
  'hodiny netto': { displayName: 'Hodiny netto', unit: 'hours', aggregation: 'sum' },
  'hodiny netto plan vt': { displayName: 'Hodiny netto Plan VT', unit: 'hours', aggregation: 'sum' },
  'cisty vykon': { displayName: 'Čistý výkon', unit: 'number', aggregation: 'ratio' },
  'cistý vykon': { displayName: 'Čistý výkon', unit: 'number', aggregation: 'ratio' },
  'struktura hodin': { displayName: 'Štruktúra hodín', unit: 'hours', aggregation: 'sum' },
  'struktura filialky (plne uvazky)': { displayName: 'Štruktúra filiálky (plné úväzky)', unit: 'fte', aggregation: 'sum' },
};

function printUsage() {
  console.log([
    'Usage:',
    '  npm run import:ist -- <path-to-ist-file> [uploadedBy] [sheetName]',
    '',
    'Examples:',
    '  npm run import:ist -- ..\\ISTGJ2026.xlsx',
    '  npm run import:ist -- ..\\ISTGJ2026.xlsx samuel@firma.sk',
    '  npm run import:ist -- ..\\ISTGJ2026.xlsx samuel@firma.sk ISTGJ2026',
  ].join('\n'));
}

function parseArgs(argv) {
  const positional = argv.filter((token) => token !== '--');
  return {
    file: String(positional[0] || ''),
    uploadedBy: String(positional[1] || ''),
    sheet: String(positional[2] || DEFAULT_SHEET_NAME),
    help: argv.includes('--help') || argv.includes('-h'),
  };
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

async function loadEnvFile(envPath) {
  try {
    const contents = await readFile(envPath, 'utf8');
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = stripQuotes(line.slice(separatorIndex + 1).trim());
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
}

function normalizeText(value) {
  return String(value || '')
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

function metricCodeFromName(metricName) {
  return normalizeText(metricName)
    .replace(/[^a-z0-9+ ]/g, '')
    .replace(/\s+/g, '-');
}

function parseNumber(value) {
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

function normalizeImportedMetricValue(metric, value) {
  const numeric = Number(value || 0);
  if (metric.unit === 'currency' && Number.isInteger(numeric) && Math.abs(numeric) >= 100000000) {
    return numeric / 1000;
  }
  return numeric;
}

function decodeFile(buffer) {
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

function parseRows(text) {
  const parsed = Papa.parse(text, {
    skipEmptyLines: 'greedy',
  });

  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message || 'Nepodarilo sa parsovať CSV súbor.');
  }

  return parsed.data;
}

function normalizeCellValue(value) {
  if (value == null) {
    return '';
  }

  return String(value).trim();
}

function parseWorkbookRows(buffer, preferredSheetName) {
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

  const rows = XLSX.utils.sheet_to_json(worksheet, {
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

function parseDelimitedRows(buffer) {
  const text = decodeFile(buffer);
  return {
    rows: parseRows(text).filter((row) => row.some((cell) => String(cell ?? '').trim() !== '')),
    sheetName: 'CSV',
  };
}

function resolveMonthLabel(monthLabel) {
  const value = String(monthLabel || '').trim();
  if (!value) {
    throw new Error('Prázdny názov mesiaca v hlavičke.');
  }

  const normalized = normalizeText(value);
  const match = normalized.match(/^([a-z]+)\s+(\d{4})$/);
  if (!match) {
    throw new Error(`Nepodarilo sa rozpoznať mesiac: ${value}`);
  }

  const [, monthName, rawYear] = match;
  const year = Number(rawYear);
  const monthMap = new Map([
    ['januar', 1],
    ['january', 1],
    ['februar', 2],
    ['february', 2],
    ['marec', 3],
    ['march', 3],
    ['april', 4],
    ['maj', 5],
    ['may', 5],
    ['jun', 6],
    ['june', 6],
    ['jul', 7],
    ['july', 7],
    ['august', 8],
    ['september', 9],
    ['oktober', 10],
    ['october', 10],
    ['november', 11],
    ['december', 12],
  ]);

  const monthNumber = monthMap.get(monthName);
  if (!monthNumber) {
    throw new Error(`Nepodarilo sa rozpoznať mesiac: ${value}`);
  }

  const businessYear = monthNumber >= 3 ? year : year - 1;
  const businessOrder = monthNumber >= 3 ? monthNumber - 2 : monthNumber + 10;
  const labelMonthNames = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december'];

  return {
    id: `${year}-${String(monthNumber).padStart(2, '0')}`,
    label: `${labelMonthNames[monthNumber - 1]} ${year}`,
    year,
    monthNumber,
    businessYear,
    businessOrder,
  };
}

function getMetricMetadata(metricName) {
  const normalized = normalizeText(metricName);
  const known = KNOWN_METRICS[normalized];
  return {
    code: metricCodeFromName(metricName),
    displayName: known?.displayName || String(metricName || '').trim(),
    unit: known?.unit || null,
    aggregation: known?.aggregation || 'sum',
  };
}

function parseWideTableImport(buffer, options = {}) {
  const fileName = String(options.fileName || '').toLowerCase();
  const parsedInput = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
    ? parseWorkbookRows(buffer, options.preferredSheetName)
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

  const values = [];
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

function filterMeaningfulIstValues(values) {
  const groups = new Map();

  for (const value of values) {
    const key = `${value.storeId}::${value.monthId}`;
    const existing = groups.get(key) || { hasNonZeroValue: false, values: [] };
    existing.values.push(value);
    if (Math.abs(Number(value.value || 0)) > 0.0001) {
      existing.hasNonZeroValue = true;
    }
    groups.set(key, existing);
  }

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

function getDatabaseUrl() {
  const directUrl = String(process.env.DIRECT_URL || '').trim();
  if (directUrl) {
    return directUrl;
  }

  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    throw new Error('Chýba DATABASE_URL alebo DIRECT_URL. Skontroluj .env alebo shell environment.');
  }

  return databaseUrl;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.file) {
    printUsage();
    process.exitCode = options.help ? 0 : 1;
    return;
  }

  await loadEnvFile(path.resolve(process.cwd(), '.env'));

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });

  try {
    const filePath = path.resolve(process.cwd(), options.file);
    const fileBuffer = await readFile(filePath);
    const parsedImport = parseWideTableImport(fileBuffer, {
      fileName: path.basename(filePath),
      preferredSheetName: options.sheet || DEFAULT_SHEET_NAME,
    });
    const currentBusinessMonth = getCurrentBusinessMonth();
    const values = filterMeaningfulIstValues(parsedImport.values.filter((value) => (
      value.businessYear === currentBusinessMonth.businessYear
      && value.businessOrder <= currentBusinessMonth.businessOrder
    )));

    if (!values.length) {
      throw new Error(`V súbore ${options.sheet || DEFAULT_SHEET_NAME} sa nenašli žiadne IST hodnoty do aktuálneho mesiaca ${currentBusinessMonth.label}.`);
    }

    const distinctStores = new Map();
    const distinctMonths = new Map();
    const distinctMetrics = new Map();

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
          source: 'IST',
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
        source: 'IST',
        fileName: path.basename(filePath),
        uploadedBy: String(options.uploadedBy || '').trim() || null,
        rowCount: values.length,
      },
    });

    for (let index = 0; index < values.length; index += CHUNK_SIZE) {
      const chunk = values.slice(index, index + CHUNK_SIZE);
      await prisma.monthlyValue.createMany({
        data: chunk.map((value) => ({
          source: 'IST',
          storeId: value.storeId,
          metricCode: value.metricCode,
          monthId: value.monthId,
          value: value.value,
          present: value.present,
          importBatchId: batch.id,
        })),
      });
    }

    console.log(`Imported IST data from ${path.basename(filePath)}.`);
    console.log(`Sheet: ${parsedImport.sheetName}`);
    console.log(`Rows: ${values.length}`);
    console.log(`Stores: ${distinctStores.size}`);
    console.log(`Months: ${distinctMonths.size}`);
    console.log(`Metrics: ${distinctMetrics.size}`);
    console.log(`Imported month range: marec ${currentBusinessMonth.businessYear} až ${currentBusinessMonth.label}`);
    console.log(`Batch: ${batch.id}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});