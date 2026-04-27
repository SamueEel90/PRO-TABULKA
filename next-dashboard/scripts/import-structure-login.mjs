import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const DEFAULT_STRUCTURE_SHEET = 'Struktura';
const DEFAULT_LOGIN_SHEET = 'Login';

function printUsage() {
  console.log([
    'Usage:',
    '  npm run import:structure-login -- <path-to-workbook> [uploadedBy] [structureSheetName] [loginSheetName]',
    '',
    'Examples:',
    '  npm run import:structure-login -- ..\\StructureLogin.xlsx',
    '  npm run import:structure-login -- ..\\StructureLogin.xlsx samuel@firma.sk',
    '  npm run import:structure-login -- ..\\StructureLogin.xlsx samuel@firma.sk Struktura Login',
  ].join('\n'));
}

function parseArgs(argv) {
  const positional = argv.filter((token) => token !== '--');
  return {
    file: String(positional[0] || ''),
    uploadedBy: String(positional[1] || ''),
    structureSheetName: String(positional[2] || DEFAULT_STRUCTURE_SHEET),
    loginSheetName: String(positional[3] || DEFAULT_LOGIN_SHEET),
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
    .replace(/\s+/g, ' ');
}

function normalizeCellValue(value) {
  if (value == null) {
    return '';
  }

  return String(value).trim();
}

function resolveSheetName(workbook, preferredSheetName, aliases) {
  const availableSheets = workbook.SheetNames || [];
  if (!availableSheets.length) {
    throw new Error('Excel súbor neobsahuje žiadny sheet.');
  }

  const requested = String(preferredSheetName || '').trim();
  if (requested) {
    const exactMatch = availableSheets.find((sheetName) => sheetName === requested);
    if (exactMatch) {
      return exactMatch;
    }

    const normalizedRequested = normalizeText(requested);
    const normalizedMatch = availableSheets.find((sheetName) => normalizeText(sheetName) === normalizedRequested);
    if (normalizedMatch) {
      return normalizedMatch;
    }
  }

  const aliasMatch = availableSheets.find((sheetName) => aliases.includes(normalizeText(sheetName)));
  if (aliasMatch) {
    return aliasMatch;
  }

  throw new Error(`Sheet ${requested || aliases[0]} sa v Excel súbore nenašiel.`);
}

function readSheetRows(workbook, sheetName) {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Sheet ${sheetName} sa v Excel súbore nenašiel.`);
  }

  return XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    blankrows: false,
    raw: false,
    defval: '',
  }).map((row) => row.map((cell) => normalizeCellValue(cell)));
}

function findHeaderRowIndex(rows, requiredHeaders) {
  return rows.findIndex((row) => {
    const normalizedRow = row.map((cell) => normalizeText(cell));
    return requiredHeaders.every((header) => normalizedRow.includes(header));
  });
}

function findColumnIndex(header, variants) {
  const normalizedHeader = header.map((cell) => normalizeText(cell));
  return normalizedHeader.findIndex((cell) => variants.includes(cell));
}

function normalizeLoginValue(value) {
  return String(value || '').trim().toLowerCase();
}

function parseStructureSheet(rows) {
  const headerIndex = findHeaderRowIndex(rows, ['gf', 'vkl', 'filialka']);
  if (headerIndex === -1) {
    throw new Error('Sheet Struktura musí obsahovať hlavičky GF, VKL a FILIALKA.');
  }

  const header = rows[headerIndex];
  const gfIndex = findColumnIndex(header, ['gf']);
  const vklIndex = findColumnIndex(header, ['vkl']);
  const storeIdIndex = findColumnIndex(header, ['filialka']);
  const storeNameIndex = findColumnIndex(header, ['nazov filialky', 'nazov filalky', 'nazov']);

  const stores = new Map();
  const storeHierarchy = new Map();
  const vklToGf = new Map();

  rows.slice(headerIndex + 1).forEach((row) => {
    const storeId = String(row[storeIdIndex] || '').trim();
    if (!storeId) {
      return;
    }

    const gfName = String(row[gfIndex] || '').trim();
    const vklName = String(row[vklIndex] || '').trim();
    const storeName = storeNameIndex >= 0 ? String(row[storeNameIndex] || '').trim() : '';

    stores.set(storeId, {
      id: storeId,
      name: storeName || storeId,
      gfName: gfName || null,
      vklName: vklName || null,
    });
    storeHierarchy.set(storeId, { gfName, vklName, storeName: storeName || storeId });

    if (vklName && gfName && !vklToGf.has(vklName)) {
      vklToGf.set(vklName, gfName);
    }
  });

  if (!stores.size) {
    throw new Error('Sheet Struktura neobsahuje žiadne filiálky.');
  }

  return {
    stores: Array.from(stores.values()),
    storeHierarchy,
    vklToGf,
  };
}

function parseLoginSheet(rows, structureContext) {
  const headerIndex = findHeaderRowIndex(rows, ['vkl', 'vkl email', 'vod', 'vod email']);
  if (headerIndex === -1) {
    throw new Error('Sheet Login musí obsahovať hlavičky minimálne VKL, VKL EMAIL, VOD a VOD EMAIL.');
  }

  const header = rows[headerIndex];
  const columnIndexes = {
    adminName: findColumnIndex(header, ['admin']),
    adminEmail: findColumnIndex(header, ['admin email']),
    gfName: findColumnIndex(header, ['gf']),
    gfEmail: findColumnIndex(header, ['gf email']),
    vklName: findColumnIndex(header, ['vkl']),
    vklEmail: findColumnIndex(header, ['vkl email']),
    vodStoreId: findColumnIndex(header, ['vod']),
    vodEmail: findColumnIndex(header, ['vod email']),
  };

  const users = new Map();
  const upsertUser = (user) => {
    if (!user || !user.email) {
      return;
    }
    users.set(user.email, user);
  };

  rows.slice(headerIndex + 1).forEach((row) => {
    const adminEmail = normalizeLoginValue(String(row[columnIndexes.adminEmail] || ''));
    const adminName = String(row[columnIndexes.adminName] || '').trim();
    upsertUser(adminEmail ? {
      email: adminEmail,
      name: adminName || adminEmail,
      role: 'ADMIN',
    } : null);

    const gfEmail = normalizeLoginValue(String(row[columnIndexes.gfEmail] || ''));
    const gfName = String(row[columnIndexes.gfName] || '').trim();
    upsertUser(gfEmail ? {
      email: gfEmail,
      name: gfName || gfEmail,
      role: 'GF',
      gfName: gfName || undefined,
    } : null);

    const vklEmail = normalizeLoginValue(String(row[columnIndexes.vklEmail] || ''));
    const vklName = String(row[columnIndexes.vklName] || '').trim();
    upsertUser(vklEmail ? {
      email: vklEmail,
      name: vklName || vklEmail,
      role: 'VKL',
      vklName: vklName || undefined,
      gfName: vklName ? structureContext.vklToGf.get(vklName) : undefined,
    } : null);

    const vodEmail = normalizeLoginValue(String(row[columnIndexes.vodEmail] || ''));
    const vodStoreId = String(row[columnIndexes.vodStoreId] || '').trim();
    const hierarchy = vodStoreId ? structureContext.storeHierarchy.get(vodStoreId) : undefined;
    upsertUser(vodEmail && vodStoreId ? {
      email: vodEmail,
      name: hierarchy?.storeName || `VOD ${vodStoreId}`,
      role: 'VOD',
      primaryStoreId: vodStoreId,
      gfName: hierarchy?.gfName,
      vklName: hierarchy?.vklName,
    } : null);
  });

  if (!users.size) {
    throw new Error('Sheet Login neobsahuje žiadne importovateľné loginy.');
  }

  return Array.from(users.values());
}

function parseStructureUsersWorkbook(buffer, options = {}) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const structureSheetName = resolveSheetName(workbook, options.structureSheetName, ['struktura', 'struktura ']);
  const loginSheetName = resolveSheetName(workbook, options.loginSheetName, ['login']);
  const structureRows = readSheetRows(workbook, structureSheetName);
  const loginRows = readSheetRows(workbook, loginSheetName);
  const structureContext = parseStructureSheet(structureRows);
  const users = parseLoginSheet(loginRows, structureContext);

  return {
    structureSheetName,
    loginSheetName,
    stores: structureContext.stores,
    users,
  };
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
    const parsedImport = parseStructureUsersWorkbook(fileBuffer, {
      structureSheetName: options.structureSheetName,
      loginSheetName: options.loginSheetName,
    });

    for (const store of parsedImport.stores) {
      await prisma.store.upsert({
        where: { id: store.id },
        update: {
          name: store.name,
          gfName: store.gfName,
          vklName: store.vklName,
        },
        create: {
          id: store.id,
          name: store.name,
          gfName: store.gfName,
          vklName: store.vklName,
        },
      });
    }

    for (const user of parsedImport.users) {
      await prisma.user.upsert({
        where: { email: user.email },
        update: {
          name: user.name,
          role: user.role,
          gfName: user.gfName || null,
          vklName: user.vklName || null,
          primaryStoreId: user.primaryStoreId || null,
        },
        create: {
          email: user.email,
          name: user.name,
          role: user.role,
          gfName: user.gfName || null,
          vklName: user.vklName || null,
          primaryStoreId: user.primaryStoreId || null,
        },
      });
    }

    await prisma.importBatch.create({
      data: {
        source: 'STRUCTURE_LOGIN',
        fileName: path.basename(filePath),
        uploadedBy: String(options.uploadedBy || '').trim() || null,
        rowCount: parsedImport.stores.length + parsedImport.users.length,
      },
    });

    console.log(`Imported structure/login data from ${path.basename(filePath)}.`);
    console.log(`Structure sheet: ${parsedImport.structureSheetName}`);
    console.log(`Login sheet: ${parsedImport.loginSheetName}`);
    console.log(`Stores: ${parsedImport.stores.length}`);
    console.log(`Users: ${parsedImport.users.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});