/**
 * Edge middleware — runs before every request matching `config.matcher`.
 *
 * Layered checks:
 *   1. Public routes (login, /api/auth/*) → pass through
 *   2. All other routes → require valid Auth.js session
 *      - missing session on /api/* → 401 JSON
 *      - missing session on UI routes → redirect to /login?callbackUrl=...
 *   3. Admin routes (/api/admin/*, /api/import/*, /admin) → require role === 'ADMIN'
 *
 * Headers injected for downstream handlers:
 *   - x-request-id   — unique per request, used by logger
 *   - x-user-id      — DB user.id from session
 *   - x-user-email
 *   - x-user-role
 *   - x-user-store, x-user-vkl, x-user-gf (when applicable)
 */

import { NextResponse, type NextRequest } from 'next/server';

import { auth } from '@/auth';

// API prefixes that don't require authentication (Auth.js own endpoints)
const PUBLIC_API_PREFIXES = ['/api/auth'];

// UI routes that don't require authentication
const PUBLIC_PAGE_ROUTES = new Set(['/login']);

// Routes that additionally require ADMIN role
const ADMIN_ROUTE_PREFIXES = ['/api/admin', '/api/import', '/admin', '/upload'];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_PAGE_ROUTES.has(pathname)) return true;
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return false;
}

function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get('x-request-id') || generateRequestId();
  const isApi = pathname.startsWith('/api/');

  // 1. Public routes pass through (still inject request ID for tracing)
  if (isPublicRoute(pathname)) {
    const headers = new Headers(request.headers);
    headers.set('x-request-id', requestId);
    return NextResponse.next({ request: { headers } });
  }

  // 2. Auth check
  const session = request.auth;
  if (!session?.user) {
    if (isApi) {
      return NextResponse.json(
        { ok: false, error: 'Neautorizované — prihlás sa.' },
        { status: 401, headers: { 'x-request-id': requestId } },
      );
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Admin role check
  if (isAdminRoute(pathname) && session.user.role !== 'ADMIN') {
    if (isApi) {
      return NextResponse.json(
        { ok: false, error: 'Vyžaduje sa rola ADMIN.' },
        { status: 403, headers: { 'x-request-id': requestId } },
      );
    }
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 4. VOD (filialka) can only access their own store's dashboard
  if (session.user.role === 'VOD' && pathname.startsWith('/dashboard')) {
    const storeId = session.user.primaryStoreId;
    if (!storeId) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    const ownPath = `/dashboard/${storeId}`;
    if (pathname !== ownPath && !pathname.startsWith(`${ownPath}/`)) {
      return NextResponse.redirect(new URL(ownPath, request.url));
    }
  }

  // Pass user info downstream so handlers don't re-verify the JWT.
  // HTTP headers must be ASCII (Latin-1) — encode any non-ASCII values
  // (Slovak diacritics in vklName/gfName) so they survive transport.
  const headers = new Headers(request.headers);
  headers.set('x-request-id', requestId);
  headers.set('x-user-id', encodeURIComponent(session.user.id));
  headers.set('x-user-email', encodeURIComponent(session.user.email || ''));
  headers.set('x-user-role', encodeURIComponent(session.user.role || ''));
  if (session.user.primaryStoreId) headers.set('x-user-store', encodeURIComponent(session.user.primaryStoreId));
  if (session.user.vklName) headers.set('x-user-vkl', encodeURIComponent(session.user.vklName));
  if (session.user.gfName) headers.set('x-user-gf', encodeURIComponent(session.user.gfName));

  return NextResponse.next({ request: { headers } });
});

/**
 * Matcher: run middleware on everything except static assets / Next internals.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
