import { NextResponse } from 'next/server';

import { generateTempPassword, hashPassword, MIN_PASSWORD_LENGTH } from '@/lib/auth/passwords';
import { ensureCacheFresh } from '@/lib/db/client';
import { prisma } from '@/lib/prisma';
import { nowIso, pushUpdate } from '@/lib/sheets/write-through';

/**
 * PATCH /api/admin/users/[id]
 * Body: { action: 'reset-password' | 'toggle-active' }
 *
 * For 'reset-password': generates a new temp password, returns it in the
 * response. ADMIN copies it once and shares with the user.
 *
 * For 'toggle-active': flips the user's `active` boolean.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureCacheFresh();
    const { id } = await ctx.params;
    const body = await request.json() as { action?: string; password?: string };
    const action = String(body.action || '').trim();
    const customPassword = body.password?.trim() || '';

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ ok: false, error: 'User neexistuje.' }, { status: 404 });
    }

    const now = nowIso();

    if (action === 'reset-password') {
      if (customPassword && customPassword.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json({ ok: false, error: `Heslo musí mať aspoň ${MIN_PASSWORD_LENGTH} znakov.` }, { status: 400 });
      }
      const tempPassword = customPassword || generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      const updated = {
        id: user.id,
        email: user.email,
        passwordHash,
        name: user.name,
        role: user.role,
        gfName: user.gfName,
        vklName: user.vklName,
        primaryStoreId: user.primaryStoreId,
        active: user.active,
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: now,
      };
      await pushUpdate('User', updated);
      await prisma.user.update({
        where: { id },
        data: { passwordHash, updatedAt: new Date(now) },
      });

      return NextResponse.json({ ok: true, tempPassword });
    }

    if (action === 'toggle-active') {
      const newActive = !user.active;
      const updated = {
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        name: user.name,
        role: user.role,
        gfName: user.gfName,
        vklName: user.vklName,
        primaryStoreId: user.primaryStoreId,
        active: newActive,
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: now,
      };
      await pushUpdate('User', updated);
      await prisma.user.update({
        where: { id },
        data: { active: newActive, updatedAt: new Date(now) },
      });

      return NextResponse.json({ ok: true, active: newActive });
    }

    return NextResponse.json({ ok: false, error: `Neznáma akcia: ${action}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Operácia zlyhala.' },
      { status: 500 },
    );
  }
}
