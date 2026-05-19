import { NextResponse } from 'next/server';

import { ensureCacheFresh } from '@/lib/db/client';
import { prisma } from '@/lib/prisma';
import { getUserFromHeaders } from '@/lib/auth/session';
import { newId, nowIso, pushDelete, pushNew, pushUpdate } from '@/lib/sheets/write-through';

/**
 * PATCH /api/ist-adjustments/[id]
 * Body: { decision: 'approve' | 'reject', decisionNote?: string }
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureCacheFresh({ force: true });

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
    const now = nowIso();

    if (decision === 'approve') {
      // Overwrite the IST MonthlyValue
      const existingMv = await prisma.monthlyValue.findUnique({
        where: { source_storeId_metricCode_monthId: { source: 'IST', storeId: req.storeId, metricCode: req.metricCode, monthId: req.monthId } },
      });
      if (existingMv) {
        const mvRecord = {
          id: existingMv.id,
          source: existingMv.source,
          storeId: existingMv.storeId,
          metricCode: existingMv.metricCode,
          monthId: existingMv.monthId,
          value: req.newValue,
          present: true,
          importedAt: existingMv.importedAt.toISOString(),
          importBatchId: existingMv.importBatchId,
          createdAt: existingMv.createdAt.toISOString(),
          updatedAt: now,
        };
        await pushUpdate('MonthlyValue', mvRecord);
        await prisma.monthlyValue.update({
          where: { id: existingMv.id },
          data: { value: req.newValue, present: true, updatedAt: new Date(now) },
        });
      }
    }

    const updatedRecord = {
      id: req.id,
      storeId: req.storeId,
      metricCode: req.metricCode,
      monthId: req.monthId,
      monthLabel: req.monthLabel,
      oldValue: req.oldValue,
      newValue: req.newValue,
      reason: req.reason,
      status: newStatus,
      requestedById: req.requestedById,
      requestedByName: req.requestedByName,
      vklName: req.vklName,
      decidedAt: now,
      decidedById: user.id,
      decidedByName: user.email,
      decisionNote,
      createdAt: req.createdAt.toISOString(),
      updatedAt: now,
    };
    await pushUpdate('IstAdjustmentRequest', updatedRecord);
    const updated = await prisma.istAdjustmentRequest.update({
      where: { id },
      data: {
        status: newStatus,
        decidedAt: new Date(now),
        decidedById: user.id,
        decidedByName: user.email,
        decisionNote,
        updatedAt: new Date(now),
      },
    });

    try {
      const activityRecord = {
        id: newId(),
        scopeKey: `STORE|${req.storeId}`,
        actorRole: user.role,
        actorName: user.email,
        action: decision === 'approve' ? 'ist-adjust-approved' : 'ist-adjust-rejected',
        metricKey: req.metricCode,
        monthLabel: req.monthLabel,
        detail: decision === 'approve'
          ? `${req.oldValue} → ${req.newValue}${decisionNote ? ` · ${decisionNote.slice(0, 120)}` : ''}`
          : `Zamietnuté${decisionNote ? ` · ${decisionNote.slice(0, 160)}` : ''}`,
        createdAt: now,
      };
      await pushNew('ActivityEntry', activityRecord);
      await prisma.activityEntry.create({
        data: { ...activityRecord, createdAt: new Date(now) },
      });
    } catch {
      /* best effort */
    }

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
 */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureCacheFresh({ force: true });
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

    await pushDelete('IstAdjustmentRequest', id);
    await prisma.istAdjustmentRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Nepodarilo sa zmazať.' },
      { status: 500 },
    );
  }
}
