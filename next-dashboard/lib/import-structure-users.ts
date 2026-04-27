import * as XLSX from 'xlsx';

type ParsedStoreHierarchy = {
  id: string;
  name: string;
  gfName: string | null;
  vklName: string | null;
};

type ParsedUserLogin = {
  email: string;
  name: string | null;
  role: 'ADMIN' | 'GF' | 'VKL' | 'VOD';
  gfName?: string;
  vklName?: string;
  primaryStoreId?: string;
};

export type ParsedStructureUsersImport = {
  structureSheetName: string;
  loginSheetName: string;
  stores: ParsedStoreHierarchy[];
  users: ParsedUserLogin[];
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
    .replace(/\s+/g, ' ');
}

function normalizeCellValue(value: unknown) {
  if (value == null) {
    return '';
  }

  return String(value).trim();
}

function resolveSheetName(workbook: XLSX.WorkBook, preferredSheetName: string | undefined, aliases: string[]) {
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

function readSheetRows(workbook: XLSX.WorkBook, sheetName: string) {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Sheet ${sheetName} sa v Excel súbore nenašiel.`);
  }

  return XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
    header: 1,
    blankrows: false,
    raw: false,
    defval: '',
  }).map((row) => row.map((cell) => normalizeCellValue(cell)));
}

function findHeaderRowIndex(rows: string[][], requiredHeaders: string[]) {
  return rows.findIndex((row) => {
    const normalizedRow = row.map((cell) => normalizeText(cell));
    return requiredHeaders.every((header) => normalizedRow.includes(header));
  });
}

function findColumnIndex(header: string[], variants: string[]) {
  const normalizedHeader = header.map((cell) => normalizeText(cell));
  return normalizedHeader.findIndex((cell) => variants.includes(cell));
}

function normalizeLoginValue(value: string) {
  return String(value || '').trim().toLowerCase();
}

function parseStructureSheet(rows: string[][]) {
  const headerIndex = findHeaderRowIndex(rows, ['gf', 'vkl', 'filialka']);
  if (headerIndex === -1) {
    throw new Error('Sheet Struktura musí obsahovať hlavičky GF, VKL a FILIALKA.');
  }

  const header = rows[headerIndex];
  const gfIndex = findColumnIndex(header, ['gf']);
  const vklIndex = findColumnIndex(header, ['vkl']);
  const storeIdIndex = findColumnIndex(header, ['filialka']);
  const storeNameIndex = findColumnIndex(header, ['nazov filialky', 'nazov filalky', 'nazov']);

  const stores = new Map<string, ParsedStoreHierarchy>();
  const storeHierarchy = new Map<string, { gfName?: string; vklName?: string; storeName?: string }>();
  const vklToGf = new Map<string, string>();

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

function parseLoginSheet(
  rows: string[][],
  structureContext: ReturnType<typeof parseStructureSheet>,
) {
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

  const users = new Map<string, ParsedUserLogin>();
  const upsertUser = (user: ParsedUserLogin | null) => {
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

export function parseStructureUsersWorkbook(
  buffer: Buffer,
  options?: { fileName?: string; structureSheetName?: string; loginSheetName?: string },
): ParsedStructureUsersImport {
  const fileName = String(options?.fileName || '').toLowerCase();
  if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
    throw new Error('Import štruktúry a loginov vyžaduje Excel workbook (.xlsx alebo .xls).');
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const structureSheetName = resolveSheetName(workbook, options?.structureSheetName, ['struktura', 'struktura ']);
  const loginSheetName = resolveSheetName(workbook, options?.loginSheetName, ['login']);
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