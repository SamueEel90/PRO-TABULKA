import { NextResponse } from 'next/server';

import { requireAdminSecret } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;
  try {
    const formData = await request.formData();
    const uploadedBy = String(formData.get('uploadedBy') || '').trim() || null;

    const [deletedIstResult, deletedVodResult, deletedWeeklyOverridesResult] = await prisma.$transaction([
      prisma.monthlyValue.deleteMany({ where: { source: 'IST' } }),
      prisma.monthlyValue.deleteMany({ where: { source: 'VOD' } }),
      prisma.weeklyVodOverride.deleteMany(),
    ]);
    const deletedIstRows = deletedIstResult.count;
    const deletedVodRows = deletedVodResult.count;
    const deletedWeeklyOverrides = deletedWeeklyOverridesResult.count;

    await prisma.importBatch.create({
      data: {
        source: 'RESET_IST_VOD',
        fileName: 'manual-reset',
        uploadedBy,
        rowCount: deletedIstRows + deletedVodRows + deletedWeeklyOverrides,
      },
    });

    return NextResponse.json({
      ok: true,
      deletedIstRows,
      deletedVodRows,
      deletedWeeklyOverrides,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Mazanie IST a VOD zlyhalo.',
      },
      { status: 500 },
    );
  }
}