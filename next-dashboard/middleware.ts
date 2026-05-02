import { NextRequest, NextResponse } from 'next/server';

/**
 * Admin API key middleware.
 * Routes under /api/admin/* and /api/import/* require the header:
 *   x-admin-secret: <ADMIN_SECRET env value>
 *
 * Later this will be replaced by Google account–bound auth.
 */

const PROTECTED_PREFIXES = ['/api/admin/', '/api/import/'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) {
    return NextResponse.next();
  }

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    // Env var not configured — block access to prevent accidental open exposure
    return NextResponse.json(
      { ok: false, error: 'Server nie je nakonfigurovaný pre admin prístup.' },
      { status: 503 },
    );
  }

  const providedSecret = request.headers.get('x-admin-secret');
  if (!providedSecret || providedSecret !== adminSecret) {
    return NextResponse.json(
      { ok: false, error: 'Neautorizovaný prístup.' },
      { status: 401 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/admin/:path*', '/api/import/:path*'],
};
