import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getUserFromHeaders } from '@/lib/auth/session';

/**
 * PATCH /api/ist-adjustments/[id]
 * Body: { decision: 'approve' | 'reject', decisionNote?: string }
 * Only VKL (matching store's vklName) or ADMIN can decide.
 * On approve, overwrites MonthlyValue (source=IST) for the request.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromHeaders(request.headers);
    const { id } = await ctx.params;

    const body = await request.json() as { decision?: string; decisionNote?: string };
    const decision = body.decision;
    if (decision !== 'approve' && decision !== 'reject') {
      return NextResponse.json({ ok: false, error: 'decision musí byť approve alebo reject.' }, { status: 400 });
    }

    const req = await prisma.istAdjustmentRequest.findUnique({ where: { id } });
    if (!req) {
      return NextResponse.json({ ok: false, error: 'Žiadosť neexistuje.' }, { status: 404 });
    }
    if (req.status !== 'pending') {
      return NextResponse.json({ ok: false, error: 'Žiadosť už bola vybavená.' }, { status: 400 });
    }

    const isAdmin = user.role === 'ADMIN';
    const isOwningVkl = user.role === 'VKL' && user.vklName && req.vklName && user.vklName === req.vklName;
    if (!isAdmin && !isOwningVkl) {
      return NextResponse.json({ ok: false, error: 'Iba VKL danej filiálky môže rozhodnúť.' }, { status: 403 });
    }

    const newStatus = decision === 'approve' ? 'approved' : 'rejected';
    const decisionNote = body.decisionNote ? String(body.decisionNote).trim().slice(0, 1000) : null;

    if (decision === 'approve') {
      // Overwrite the IST MonthlyValue
      await prisma.monthlyValue.update({
        where: { source_storeId_metricCode_monthId: { source: 'IST', storeId: req.storeId, metricCode: req.metricCode, monthId: req.monthId } },
        data: { value: req.newValue, present: true },
      });
    }

    const updated = await prisma.istAdjustmentRequest.update({
      where: { id },
      data: {
        status: newStatus,
        decidedAt: new Date(),
        decidedById: user.id,
        decidedByName: user.email,
        decisionNote,
      },
    });

    await prisma.activityEntry.create({
      data: {
        scopeKey: `STORE|${req.storeId}`,
        actorRole: user.role,
        actorName: user.email,
        action: decision === 'approve' ? 'ist-adjust-approved' : 'ist-adjust-rejected',
        metricKey: req.metricCode,
        monthLabel: req.monthLabel,
        detail: decision === 'approve'
          ? `${req.oldValue} → ${req.newValue}${decisionNote ? ` · ${decisionNote.slice(0, 120)}` : ''}`
          : `Zamietnuté${decisionNote ? ` · ${decisionNote.slice(0, 160)}` : ''}`,
      },
    }).catch(() => { /* best effort */ });

    return NextResponse.json({ ok: true, request: updated });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Nepodarilo sa rozhodnúť.' },
      { status },
    );
  }
}

/**
 * DELETE /api/ist-adjustments/[id]
 * VOD that created the request can cancel it while pending.
 */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromHeaders(request.headers);
    const { id } = await ctx.params;

    const req = await prisma.istAdjustmentRequest.findUnique({ where: { id } });
    if (!req) {
      return NextResponse.json({ ok: false, error: 'Žiadosť neexistuje.' }, { status: 404 });
    }

    const isOwner = user.id === req.requestedById;
    const isAdmin = user.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ ok: false, error: 'Nemáš oprávnenie zmazať túto žiadosť.' }, { status: 403 });
    }
    if (req.status !== 'pending' && !isAdmin) {
      return NextResponse.json({ ok: false, error: 'Vybavenú žiadosť nie je možné zmazať.' }, { status: 400 });
    }

    await prisma.istAdjustmentRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Nepodarilo sa zmazať.' },
      { status: 500 },
    );
  }
}
