import { NextResponse } from 'next/server';

/**
 * Server-side guard for admin API routes.
 * Returns a 401 NextResponse if the request is not authorised,
 * or null if the secret is valid and execution may continue.
 *
 * Usage in a route handler:
 *   const denied = requireAdminSecret(request);
 *   if (denied) return denied;
 */
export function requireAdminSecret(request: Request): NextResponse | null {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json(
      { ok: false, error: 'Server nie je nakonfigurovaný pre admin prístup.' },
      { status: 503 },
    );
  }
  const provided = (request as { headers: Headers }).headers.get('x-admin-secret');
  if (!provided || provided !== adminSecret) {
    return NextResponse.json(
      { ok: false, error: 'Neautorizovaný prístup.' },
      { status: 401 },
    );
  }
  return null;
}
