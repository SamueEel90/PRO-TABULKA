import { NextResponse } from 'next/server';

import { requireAdminSecret } from '@/lib/auth';
import { parseStructureUsersWorkbook } from '@/lib/import-structure-users';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;
  try {
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
        fileName: file.name,
        uploadedBy,
        rowCount: parsedImport.stores.length + parsedImport.users.length,
      },
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
      {
        error: error instanceof Error ? error.message : 'Import štruktúry a loginov zlyhal.',
      },
      { status: 500 },
    );
  }
}