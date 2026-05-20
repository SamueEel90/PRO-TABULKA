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
 * Ensure the local SQLite cache is fresh against Sheets.
 * Call once per request before reading. On cold lambdas this rebuilds the
 * cache from scratch (~5-15s); on warm lambdas within FRESHNESS_TTL_MS it's
 * a no-op; otherwise a cheap modifiedTime check (~500ms).
 *
 * Pass `{ force: true }` to skip the TTL and always re-check upstream.
 * Use for routes serving user-generated content (notes, tasks, activity)
 * where cross-lambda cache divergence causes visible flicker after writes.
 *
 * In Fáza 4 this gets wired into the apiRoute wrapper so call sites don't
 * have to think about it.
 */
export async function ensureCacheFresh(opts?: { force?: boolean }): Promise<void> {
  const { ensureFresh } = await import('./bootstrap');
  await ensureFresh(db, opts);
}

/**
 * Name of the short-lived cookie that signals "this client just performed a
 * write — the next reads must re-validate against Sheets even if the lambda's
 * own cache claims freshness". Set by the write endpoints, honored by read
 * endpoints. Breaks per-lambda cache divergence on Vercel where the lambda
 * serving the read may not be the one that handled the write.
 *
 * Lifetime 60s: long enough to cover the dashboard reload + secondary fetches
 * (notes / tasks / activity / scope-notes) that follow a save by a few seconds.
 */
export const AFTER_SAVE_COOKIE = 'pro_after_save';
export const AFTER_SAVE_TTL_SECONDS = 60;

/**
 * Read the after-save cookie value off a Request, or null. Cheap header parse,
 * no regex.
 */
export function readAfterSaveCookie(request: Request): string | null {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    if (part.slice(0, eq) === AFTER_SAVE_COOKIE) return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}

/**
 * Convenience: `ensureCacheFresh` with `force=true` if the after-save cookie
 * is present on `request`, otherwise normal (TTL-respecting) behavior. Use
 * from any read endpoint that's called soon after a write.
 */
export async function ensureCacheFreshForRequest(request: Request): Promise<void> {
  const force = readAfterSaveCookie(request) !== null;
  await ensureCacheFresh({ force });
}

/**
 * Stamp the after-save cookie on a response. Call from any write endpoint —
 * the cookie tells subsequent reads to skip TTL and re-validate against
 * Sheets. Without this, a read on a different lambda might serve stale data
 * for up to FRESHNESS_TTL_MS (5s) after our write.
 *
 * Returns the same response for chaining: `return setAfterSaveCookie(res);`
 */
export function setAfterSaveCookie<T extends { cookies: { set: (opts: { name: string; value: string; path: string; maxAge: number; sameSite: 'lax' }) => unknown } }>(response: T): T {
  response.cookies.set({
    name: AFTER_SAVE_COOKIE,
    value: new Date().toISOString(),
    path: '/',
    maxAge: AFTER_SAVE_TTL_SECONDS,
    sameSite: 'lax',
  });
  return response;
}

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
