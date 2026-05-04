/**
 * Centralized Prisma client.
 *
 * Single instance reused across hot reloads in dev.
 * In production each Lambda/edge invocation gets its own.
 *
 * Use the `db` export everywhere. Avoid creating new PrismaClient() instances.
 *
 *   import { db } from '@/lib/db/client';
 *   const users = await db.user.findMany();
 *
 * For multi-step writes, wrap in a transaction:
 *
 *   import { db, withTransaction } from '@/lib/db/client';
 *   await withTransaction(async (tx) => {
 *     await tx.monthlyValue.upsert(...);
 *     await tx.activityEntry.create(...);
 *   });
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['warn', 'error']
    : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

export type DbClient = typeof db;
export type DbTx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Wrap a multi-write operation in a transaction.
 * Rolls back automatically if any step throws.
 */
export function withTransaction<T>(
  fn: (tx: DbTx) => Promise<T>,
  options?: { timeoutMs?: number; maxWaitMs?: number },
): Promise<T> {
  return db.$transaction(fn, {
    timeout: options?.timeoutMs ?? 15_000,
    maxWait: options?.maxWaitMs ?? 5_000,
  });
}
