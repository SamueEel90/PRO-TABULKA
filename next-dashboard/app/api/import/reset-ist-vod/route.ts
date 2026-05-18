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

    // Count what we're about to delete from cache (for the response)
    const [deletedIst, deletedVod, deletedOverrides] = await Promise.all([
      prisma.monthlyValue.count({ where: { source: 'IST' } }),
      prisma.monthlyValue.count({ where: { source: 'VOD' } }),
      prisma.weeklyVodOverride.count(),
    ]);

    // Sheets — replace MonthlyValue keeping only non-IST/non-VOD rows, wipe WeeklyVodOverride
    await pushBulkReplaceSlice(
      'MonthlyValue',
      (r) => r.source === 'IST' || r.source === 'VOD',
      [],
    );
    await pushBulkReplace('WeeklyVodOverride', []);

    // Cache mirror
    await prisma.$transaction([
      prisma.monthlyValue.deleteMany({ where: { source: 'IST' } }),
      prisma.monthlyValue.deleteMany({ where: { source: 'VOD' } }),
      prisma.weeklyVodOverride.deleteMany(),
    ]);

    // Audit log
    const now = nowIso();
    const batchRecord = {
      id: newId(),
      source: 'RESET_IST_VOD',
      fileName: 'manual-reset',
      uploadedBy: uploadedBy ?? null,
      status: 'completed',
      rowCount: deletedIst + deletedVod + deletedOverrides,
      monthId: null,
      createdAt: now,
    };
    await pushNew('ImportBatch', batchRecord);
    await prisma.importBatch.create({ data: { ...batchRecord, createdAt: new Date(now) } });

    return NextResponse.json({
      ok: true,
      deletedIstRows: deletedIst,
      deletedVodRows: deletedVod,
      deletedWeeklyOverrides: deletedOverrides,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mazanie IST a VOD zlyhalo.' },
      { status: 500 },
    );
  }
}
