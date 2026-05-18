import { NextResponse } from 'next/server';

import { requireAdminSecret } from '@/lib/auth';
import { ensureCacheFresh } from '@/lib/db/client';
import { prisma } from '@/lib/prisma';
import { newId, nowIso, pushBulkReplaceSlice, pushBulkReplace, pushNew } from '@/lib/sheets/write-through';

export async function POST(request: Request) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;
  try {
    await ensureCacheFresh();

    const formData = await request.formData();
    const uploadedBy = String(formData.get('uploadedBy') || '').trim() || null;

    const [deletedVod, deletedOverrides] = await Promise.all([
      prisma.monthlyValue.count({ where: { source: 'VOD' } }),
      prisma.weeklyVodOverride.count(),
    ]);

    // Sheets — drop VOD-source values and wipe overrides
    await pushBulkReplaceSlice('MonthlyValue', (r) => r.source === 'VOD', []);
    await pushBulkReplace('WeeklyVodOverride', []);

    // Cache mirror
    await prisma.$transaction([
      prisma.monthlyValue.deleteMany({ where: { source: 'VOD' } }),
      prisma.weeklyVodOverride.deleteMany(),
    ]);

    // Audit log
    const now = nowIso();
    const batchRecord = {
      id: newId(),
      source: 'RESET_VOD',
      fileName: 'manual-reset',
      uploadedBy: uploadedBy ?? null,
      status: 'completed',
      rowCount: deletedVod + deletedOverrides,
      monthId: null,
      createdAt: now,
    };
    await pushNew('ImportBatch', batchRecord);
    await prisma.importBatch.create({ data: { ...batchRecord, createdAt: new Date(now) } });

    return NextResponse.json({
      ok: true,
      deletedVodRows: deletedVod,
      deletedWeeklyOverrides: deletedOverrides,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mazanie úprav VOD zlyhalo.' },
      { status: 500 },
    );
  }
}
