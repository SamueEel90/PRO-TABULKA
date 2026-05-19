import { NextResponse } from 'next/server';

import { ensureCacheFresh } from '@/lib/db/client';
import { prisma } from '@/lib/prisma';
import { pushDelete } from '@/lib/sheets/write-through';

/**
 * DELETE /api/notes/[id]
 * Deletes a note comment. If the comment has a linked task, the task is also deleted.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureCacheFresh({ force: true });
    const { id } = await params;

    const comment = await prisma.noteComment.findUnique({
      where: { id },
      include: { task: true },
    });

    if (!comment) {
      return NextResponse.json({ ok: false, error: 'Komentár neexistuje.' }, { status: 404 });
    }

    if (comment.task) {
      await pushDelete('TaskItem', comment.task.id);
      await prisma.taskItem.delete({ where: { id: comment.task.id } });
    }

    await pushDelete('NoteComment', id);
    await prisma.noteComment.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Nepodarilo sa zmazať komentár.' },
      { status: 500 },
    );
  }
}
