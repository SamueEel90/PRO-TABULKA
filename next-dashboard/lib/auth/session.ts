/**
 * Session helpers for route handlers and server components.
 *
 * Two ways to get the current user:
 *
 *  A) From middleware-injected headers (FAST, no DB lookup, no JWT decode):
 *       import { headers } from 'next/headers';
 *       const user = getUserFromHeaders(await headers());
 *
 *  B) From Auth.js session directly (slower, but works without middleware):
 *       import { auth } from '@/auth';
 *       const session = await auth();
 *
 * Always prefer (A) inside routes that go through middleware.
 */

import { HttpError } from '@/lib/api/handler';

import type { Role } from '@/lib/schemas/common';

export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
  primaryStoreId: string | null;
  vklName: string | null;
  gfName: string | null;
};

function readHeader(headers: Headers, name: string): string | null {
  const raw = headers.get(name);
  if (raw == null) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Read the current user from middleware-injected headers.
 * Values are URL-decoded (middleware encodes them so non-ASCII
 * characters like Š survive HTTP transport).
 * Throws 401 if no session present (shouldn't happen on protected routes).
 */
export function getUserFromHeaders(headers: Headers): CurrentUser {
  const id = readHeader(headers, 'x-user-id');
  const email = readHeader(headers, 'x-user-email');
  const role = readHeader(headers, 'x-user-role') as Role | null;

  if (!id || !email || !role) {
    throw new HttpError(401, 'Chýba session — prihlás sa znova.');
  }

  return {
    id,
    email,
    role,
    primaryStoreId: readHeader(headers, 'x-user-store'),
    vklName: readHeader(headers, 'x-user-vkl'),
    gfName: readHeader(headers, 'x-user-gf'),
  };
}

/** Throws 403 if user does not have the required role. */
export function requireRole(user: CurrentUser, ...allowed: Role[]): void {
  if (!allowed.includes(user.role)) {
    throw new HttpError(403, `Vyžaduje sa rola: ${allowed.join(' alebo ')}.`);
  }
}
