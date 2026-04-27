import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

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

export async function GET() {
  try {
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
  try {
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

    for (const store of normalizedStores) {
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

    for (const user of normalizedUsers) {
      if (user.markedForDelete) {
        if (user.id) {
          await prisma.user.deleteMany({ where: { id: user.id } });
        } else if (user.email) {
          await prisma.user.deleteMany({ where: { email: user.email } });
        }
        continue;
      }

      await prisma.user.upsert({
        where: { email: user.email },
        update: {
          name: user.name,
          role: user.role,
          gfName: user.gfName,
          vklName: user.vklName,
          primaryStoreId: user.primaryStoreId,
        },
        create: {
          email: user.email,
          name: user.name,
          role: user.role,
          gfName: user.gfName,
          vklName: user.vklName,
          primaryStoreId: user.primaryStoreId,
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