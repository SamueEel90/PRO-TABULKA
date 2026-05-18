import { NextResponse } from 'next/server';

import { ensureCacheFresh } from '@/lib/db/client';
import { parseStructureUsersWorkbook } from '@/lib/import-structure-users';
import { prisma } from '@/lib/prisma';
import { newId, nowIso, pushBulkReplaceSlice, pushNew } from '@/lib/sheets/write-through';

export async function POST(request: Request) {
  try {
    await ensureCacheFresh();

    const formData = await request.formData();
    const file = formData.get('file');
    const uploadedBy = String(formData.get('uploadedBy') || '').trim() || null;
    const structureSheetName = String(formData.get('structureSheetName') || '').trim();
    const loginSheetName = String(formData.get('loginSheetName') || '').trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Chýba importovaný súbor.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const parsedImport = parseStructureUsersWorkbook(Buffer.from(arrayBuffer), {
      fileName: file.name,
      structureSheetName,
      loginSheetName,
    });

    const now = nowIso();
    const storeIds = parsedImport.stores.map(s => s.id);
    const emails = parsedImport.users.map(u => u.email).filter(Boolean);

    // STORES — bulk replace in Sheets, upsert in cache (FK refs from MonthlyValue/User)
    {
      const records = parsedImport.stores.map(s => ({
        id: s.id,
        name: s.name,
        gfName: s.gfName ?? null,
        vklName: s.vklName ?? null,
        createdAt: now,
        updatedAt: now,
      }));
      const idSet = new Set(storeIds);
      await pushBulkReplaceSlice('Store', (r) => idSet.has(String(r.id)), records);
      for (const r of records) {
        await prisma.store.upsert({
          where: { id: r.id },
          update: { name: r.name, gfName: r.gfName, vklName: r.vklName, updatedAt: new Date(now) },
          create: { ...r, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) },
        });
      }
    }

    // USERS — bulk replace in Sheets, upsert in cache
    {
      const existing = await prisma.user.findMany({ where: { email: { in: emails } } });
      const existingByEmail = new Map(existing.map(e => [e.email, e]));
      const records = parsedImport.users.map(u => {
        const ex = existingByEmail.get(u.email);
        return {
          id: ex?.id ?? newId(),
          email: u.email,
          passwordHash: ex?.passwordHash ?? null,
          name: u.name,
          role: u.role,
          gfName: u.gfName || null,
          vklName: u.vklName || null,
          primaryStoreId: u.primaryStoreId || null,
          active: ex?.active ?? true,
          lastLoginAt: ex?.lastLoginAt ? ex.lastLoginAt.toISOString() : null,
          createdAt: ex ? ex.createdAt.toISOString() : now,
          updatedAt: now,
        };
      });
      const emailSet = new Set(emails);
      await pushBulkReplaceSlice('User', (r) => emailSet.has(String(r.email)), records);
      for (const r of records) {
        await prisma.user.upsert({
          where: { email: r.email },
          update: {
            name: r.name, role: r.role,
            gfName: r.gfName, vklName: r.vklName, primaryStoreId: r.primaryStoreId,
            updatedAt: new Date(now),
          },
          create: {
            ...r,
            lastLoginAt: r.lastLoginAt ? new Date(r.lastLoginAt) : null,
            createdAt: new Date(r.createdAt),
            updatedAt: new Date(r.updatedAt),
          },
        });
      }
    }

    // IMPORT BATCH log
    const batchRecord = {
      id: newId(),
      source: 'STRUCTURE_LOGIN',
      fileName: file.name,
      uploadedBy: uploadedBy ?? null,
      status: 'completed',
      rowCount: parsedImport.stores.length + parsedImport.users.length,
      monthId: null,
      createdAt: now,
    };
    await pushNew('ImportBatch', batchRecord);
    await prisma.importBatch.create({
      data: { ...batchRecord, createdAt: new Date(now) },
    });

    return NextResponse.json({
      ok: true,
      fileName: file.name,
      structureSheetName: parsedImport.structureSheetName,
      loginSheetName: parsedImport.loginSheetName,
      stores: parsedImport.stores.length,
      users: parsedImport.users.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import štruktúry a loginov zlyhal.' },
      { status: 500 },
    );
  }
}
