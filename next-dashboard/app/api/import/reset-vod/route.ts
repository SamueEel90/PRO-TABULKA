import { NextResponse } from 'next/server';

import { requireAdminSecret } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const denied = requireAdminSecret(request);
  if (denied) return denied;
  try {
    const formData = await request.formData();
    const uploadedBy = String(formData.get('uploadedBy') || '').trim() || null;

    const [deletedVodResult, deletedWeeklyOverridesResult] = await prisma.$transaction([
      prisma.monthlyValue.deleteMany({ where: { source: 'VOD' } }),
      prisma.weeklyVodOverride.deleteMany(),
    ]);
    const deletedVodRows = deletedVodResult.count;
    const deletedWeeklyOverrides = deletedWeeklyOverridesResult.count;

    await prisma.importBatch.create({
      data: {
        source: 'RESET_VOD',
        fileName: 'manual-reset',
        uploadedBy,
        rowCount: deletedVodRows + deletedWeeklyOverrides,
      },
    });

    return NextResponse.json({
      ok: true,
      deletedVodRows,
      deletedWeeklyOverrides,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Mazanie úprav VOD zlyhalo.',
      },
      { status: 500 },
    );
  }
}
