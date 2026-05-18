import { NextResponse } from 'next/server';

import { requireAdminSecret } from '@/lib/auth';
import { ensureCacheFresh } from '@/lib/db/client';
import { prisma } from '@/lib/prisma';
import { newId, nowIso, pushBulkReplaceSlice } from '@/lib/sheets/write-through';

type StoreInput = {
  id: string;
  name: string;
  gfName?: string | null;
  vklName?: string | null;
};

type UserInput = {
  id?: string;
  email: string;
  name?: string | null;
  role: string;
  gfName?: string | null;
  vklName?: string | null;
  primaryStoreId?: string | null;
  markedForDelete?: boolean;
};

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeNullable(value: unknown) {
  const normalized = normalizeText(value);
  return normalized || null;
}

export async function GET(request: Request) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;
  try {
    await ensureCacheFresh();
    const [stores, users] = await Promise.all([
      prisma.store.findMany({ orderBy: [{ gfName: 'asc' }, { vklName: 'asc' }, { id: 'asc' }] }),
      prisma.user.findMany({ orderBy: [{ role: 'asc' }, { gfName: 'asc' }, { vklName: 'asc' }, { primaryStoreId: 'asc' }, { email: 'asc' }] }),
    ]);

    return NextResponse.json({
      ok: true,
      stores: stores.map((store) => ({
        id: store.id,
        name: store.name,
        gfName: store.gfName || '',
        vklName: store.vklName || '',
      })),
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name || '',
        role: user.role,
        gfName: user.gfName || '',
        vklName: user.vklName || '',
        primaryStoreId: user.primaryStoreId || '',
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Načítanie štruktúry zlyhalo.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;
  try {
    await ensureCacheFresh();
    const payload = await request.json() as { stores?: StoreInput[]; users?: UserInput[] };
    const stores = Array.isArray(payload.stores) ? payload.stores : [];
    const users = Array.isArray(payload.users) ? payload.users : [];

    if (!stores.length) {
      return NextResponse.json({ error: 'Chýbajú filiálky na uloženie.' }, { status: 400 });
    }

    const normalizedStores = stores.map((store) => ({
      id: normalizeText(store.id),
      name: normalizeText(store.name),
      gfName: normalizeNullable(store.gfName),
      vklName: normalizeNullable(store.vklName),
    })).filter((store) => store.id && store.name);

    if (!normalizedStores.length) {
      return NextResponse.json({ error: 'Po vyčistení neostala žiadna platná filiálka.' }, { status: 400 });
    }

    const validStoreIds = new Set(normalizedStores.map((store) => store.id));
    const normalizedUsers = users.map((user) => ({
      id: normalizeText(user.id),
      email: normalizeEmail(user.email),
      name: normalizeNullable(user.name),
      role: normalizeText(user.role).toUpperCase(),
      gfName: normalizeNullable(user.gfName),
      vklName: normalizeNullable(user.vklName),
      primaryStoreId: normalizeNullable(user.primaryStoreId),
      markedForDelete: Boolean(user.markedForDelete),
    }));

    for (const user of normalizedUsers) {
      if (user.markedForDelete) {
        continue;
      }
      if (!user.email) {
        return NextResponse.json({ error: 'Každý používateľ musí mať email.' }, { status: 400 });
      }
      if (!['ADMIN', 'GF', 'VKL', 'VOD'].includes(user.role)) {
        return NextResponse.json({ error: `Neplatná rola používateľa: ${user.role || '(prázdne)'}.` }, { status: 400 });
      }
      if (user.primaryStoreId && !validStoreIds.has(user.primaryStoreId)) {
        return NextResponse.json({ error: `Používateľ ${user.email} odkazuje na neznámu filiálku ${user.primaryStoreId}.` }, { status: 400 });
      }
    }

    const now = nowIso();

    // STORES — bulk replace by id. Stores in payload override matching cache rows;
    // stores not in payload are kept untouched.
    const existingStores = await prisma.store.findMany();
    const storeIdsInPayload = new Set(normalizedStores.map(s => s.id));
    const storeRecords = normalizedStores.map(s => {
      const ex = existingStores.find(e => e.id === s.id);
      return {
        id: s.id,
        name: s.name,
        gfName: s.gfName,
        vklName: s.vklName,
        createdAt: ex ? ex.createdAt.toISOString() : now,
        updatedAt: now,
      };
    });
    await pushBulkReplaceSlice(
      'Store',
      (r) => storeIdsInPayload.has(String(r.id)),
      storeRecords,
    );
    // Mirror to cache via upsert (FK refs from MonthlyValue prevent delete)
    for (const s of storeRecords) {
      await prisma.store.upsert({
        where: { id: s.id },
        update: { name: s.name, gfName: s.gfName, vklName: s.vklName, updatedAt: new Date(now) },
        create: { ...s, createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt) },
      });
    }

    // USERS — same pattern, keyed by email.
    const existingUsers = await prisma.user.findMany();
    const emailToExisting = new Map(existingUsers.map(u => [u.email, u]));
    const emailsInPayload = new Set(normalizedUsers.map(u => u.email).filter(Boolean));

    const userRecordsToKeep = normalizedUsers
      .filter(u => !u.markedForDelete && u.email)
      .map(u => {
        const ex = emailToExisting.get(u.email);
        return {
          id: ex?.id ?? (u.id || newId()),
          email: u.email,
          passwordHash: ex?.passwordHash ?? null,
          name: u.name,
          role: u.role,
          gfName: u.gfName,
          vklName: u.vklName,
          primaryStoreId: u.primaryStoreId,
          active: ex?.active ?? true,
          lastLoginAt: ex?.lastLoginAt ? ex.lastLoginAt.toISOString() : null,
          createdAt: ex ? ex.createdAt.toISOString() : now,
          updatedAt: now,
        };
      });

    await pushBulkReplaceSlice(
      'User',
      (r) => emailsInPayload.has(String(r.email)),
      userRecordsToKeep,
    );

    // Mirror to cache via upsert
    for (const u of userRecordsToKeep) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: {
          name: u.name, role: u.role,
          gfName: u.gfName, vklName: u.vklName, primaryStoreId: u.primaryStoreId,
          updatedAt: new Date(now),
        },
        create: {
          ...u,
          lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
          createdAt: new Date(u.createdAt),
          updatedAt: new Date(u.updatedAt),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      storesSaved: normalizedStores.length,
      usersSaved: normalizedUsers.filter((user) => !user.markedForDelete).length,
      usersDeleted: normalizedUsers.filter((user) => user.markedForDelete).length,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Uloženie štruktúry zlyhalo.' }, { status: 500 });
  }
}