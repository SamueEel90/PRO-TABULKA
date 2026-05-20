import { NextResponse } from 'next/server';

import { ensureCacheFresh } from '@/lib/db/client';
import { prisma } from '@/lib/prisma';
import { newId, nowIso, pushBulkReplace, pushNew } from '@/lib/sheets/write-through';

/**
 * POST /api/import/reset-discussions
 *
 * Wipes all comment-thread + note data:
 *   - NoteComment  (per-metric threaded comments)
 *   - TaskItem     (followups created from comments; tightly coupled)
 *   - DashboardNote (legacy single-note per metric/role/scope)
 *
 * Preserves: ActivityEntry (audit log), MonthlyValue/IST/PLAN data, structure,
 * users, weekly overrides. Use this for a clean slate of discussions when
 * test data piles up.
 */
export async function POST(request: Request) {
  try {
    await ensureCacheFresh();

    const formData = await request.formData();
    const uploadedBy = String(formData.get('uploadedBy') || '').trim() || null;

    const [deletedComments, deletedTasks, deletedNotes] = await Promise.all([
      prisma.noteComment.count(),
      prisma.taskItem.count(),
      prisma.dashboardNote.count(),
    ]);

    // Sheets — wipe the three tabs in dependency order. TaskItem references
    // NoteComment via sourceCommentId so it should be drained first.
    await pushBulkReplace('TaskItem', []);
    await pushBulkReplace('NoteComment', []);
    await pushBulkReplace('DashboardNote', []);

    // Cache mirror — order: TaskItem (child FK to NoteComment) first.
    await prisma.$transaction([
      prisma.taskItem.deleteMany(),
      prisma.noteComment.deleteMany(),
      prisma.dashboardNote.deleteMany(),
    ]);

    // Audit log
    const now = nowIso();
    const batchRecord = {
      id: newId(),
      source: 'RESET_DISCUSSIONS',
      fileName: 'manual-reset',
      uploadedBy: uploadedBy ?? null,
      status: 'completed',
      rowCount: deletedComments + deletedTasks + deletedNotes,
      monthId: null,
      createdAt: now,
    };
    await pushNew('ImportBatch', batchRecord);
    await prisma.importBatch.create({ data: { ...batchRecord, createdAt: new Date(now) } });

    return NextResponse.json({
      ok: true,
      deletedComments,
      deletedTasks,
      deletedNotes,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mazanie komentárov a poznámok zlyhalo.' },
      { status: 500 },
    );
  }
}
