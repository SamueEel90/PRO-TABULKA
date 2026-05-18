import { NextResponse } from 'next/server';

import { generateTempPassword, hashPassword } from '@/lib/auth/passwords';
import { ensureCacheFresh } from '@/lib/db/client';
import { prisma } from '@/lib/prisma';
import { newId, nowIso, pushNew } from '@/lib/sheets/write-through';

/**
 * GET /api/admin/users
 * Returns all users for the admin table.
 */
export async function GET() {
  try {
    await ensureCacheFresh();
    const users = await prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
      select: {
        id: true, email: true, name: true, role: true,
        gfName: true, vklName: true, primaryStoreId: true,
        active: true, lastLoginAt: true, createdAt: true,
      },
    });
    return NextResponse.json({ ok: true, users });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Nepodarilo sa načítať userov.' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/users
 * Body: { email, name?, role, primaryStoreId?, gfName?, vklName? }
 * Creates a new user with a generated temp password. Returns the password
 * in the response — ADMIN sees it once, copies it, and shares it with the user.
 */
export async function POST(request: Request) {
  try {
    await ensureCacheFresh();

    const body = await request.json() as {
      email?: string; name?: string; role?: string;
      primaryStoreId?: string; gfName?: string; vklName?: string;
      password?: string;
    };

    const email = String(body.email || '').trim().toLowerCase();
    const role = String(body.role || '').trim().toUpperCase();
    const name = body.name?.trim() || null;
    const primaryStoreId = body.primaryStoreId?.trim() || null;
    const gfName = body.gfName?.trim() || null;
    const vklName = body.vklName?.trim() || null;
    const customPassword = body.password?.trim() || '';

    if (!email) {
      return NextResponse.json({ ok: false, error: 'Email je povinný.' }, { status: 400 });
    }
    if (!['VOD', 'VKL', 'GF', 'GL', 'ADMIN'].includes(role)) {
      return NextResponse.json({ ok: false, error: `Neplatná rola: ${role}.` }, { status: 400 });
    }
    if (customPassword && customPassword.length < 6) {
      return NextResponse.json({ ok: false, error: 'Heslo musí mať aspoň 6 znakov.' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: false, error: `User s emailom ${email} už existuje.` }, { status: 409 });
    }

    if (primaryStoreId) {
      const storeExists = await prisma.store.findUnique({ where: { id: primaryStoreId } });
      if (!storeExists) {
        return NextResponse.json({ ok: false, error: `Filiálka ${primaryStoreId} neexistuje.` }, { status: 400 });
      }
    }

    const tempPassword = customPassword || generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const now = nowIso();
    const record = {
      id: newId(),
      email,
      passwordHash,
      name,
      role,
      gfName,
      vklName,
      primaryStoreId,
      active: true,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await pushNew('User', record);
    await prisma.user.create({
      data: { ...record, lastLoginAt: null, createdAt: new Date(now), updatedAt: new Date(now) },
    });

    return NextResponse.json({
      ok: true,
      user: { ...record, passwordHash: undefined },
      tempPassword,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Nepodarilo sa vytvoriť usera.' },
      { status: 500 },
    );
  }
}
