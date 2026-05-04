/**
 * Standardized HTTP handler wrapper.
 *
 * Wrap every route handler with `apiRoute(...)` to get:
 *  - automatic Zod input validation
 *  - structured error responses ({ ok, error, ... })
 *  - request ID + scoped logger
 *  - consistent error logging
 *  - typed response envelope
 *
 * Usage:
 *
 *   // GET /api/notes?scopeKey=STORE|1020&metricKey=Obrat
 *   export const GET = apiRoute({
 *     query: z.object({ scopeKey: ScopeKey, metricKey: NonEmptyString }),
 *     handler: async ({ query, log }) => {
 *       log.info({ scopeKey: query.scopeKey }, 'fetching comments');
 *       const comments = await notesService.list(query);
 *       return { comments };
 *     },
 *   });
 *
 * The handler returns the *data* — the wrapper builds { ok: true, ...data }.
 * Throw HttpError(status, message) to return error responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';

import { buildRequestLogger, type Logger } from '@/lib/logger';

import type { CurrentUser } from '@/lib/auth/session';

export class HttpError extends Error {
  constructor(public readonly status: number, message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'HttpError';
  }
}

export type RouteContext<TQuery = unknown, TBody = unknown, TParams = unknown> = {
  request: NextRequest;
  query: TQuery;
  body: TBody;
  params: TParams;
  log: Logger;
  requestId: string;
  /** Current authenticated user, populated when `requireAuth: true`. */
  user: CurrentUser | null;
};

type HandlerFn<TQuery, TBody, TParams> = (
  ctx: RouteContext<TQuery, TBody, TParams>,
) => Promise<unknown> | unknown;

type RouteOptions<TQuery, TBody, TParams> = {
  query?: ZodSchema<TQuery>;
  body?: ZodSchema<TBody>;
  params?: ZodSchema<TParams>;
  /**
   * If true (default), reads the authenticated user from middleware-injected
   * headers and exposes it as `ctx.user`. Throws 401 if missing.
   * Set to `false` for public endpoints.
   */
  requireAuth?: boolean;
  /** Restrict to specific roles. Implies requireAuth. */
  roles?: ReadonlyArray<'VOD' | 'VKL' | 'GF' | 'ADMIN'>;
  handler: HandlerFn<TQuery, TBody, TParams>;
};

type NextRouteContext<TParams> = {
  params: Promise<TParams> | TParams;
};

function generateRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseSchema<T>(schema: ZodSchema<T> | undefined, value: unknown, kind: 'query' | 'body' | 'params'): T {
  if (!schema) return value as T;
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(400, `Neplatný ${kind}`, error.flatten());
    }
    throw error;
  }
}

export function apiRoute<TQuery = unknown, TBody = unknown, TParams = unknown>(
  options: RouteOptions<TQuery, TBody, TParams>,
) {
  return async (request: NextRequest, ctx: NextRouteContext<TParams> = {} as NextRouteContext<TParams>) => {
    const requestId = request.headers.get('x-request-id') || generateRequestId();
    const log = buildRequestLogger(requestId, {
      method: request.method,
      path: new URL(request.url).pathname,
    });

    try {
      // Parse query
      const url = new URL(request.url);
      const queryRaw: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        queryRaw[key] = value;
      });
      const query = parseSchema(options.query, queryRaw, 'query');

      // Parse body (only for non-GET)
      let body: TBody = undefined as TBody;
      if (request.method !== 'GET' && request.method !== 'HEAD' && options.body) {
        let bodyRaw: unknown = {};
        try {
          bodyRaw = await request.json();
        } catch {
          throw new HttpError(400, 'Telo požiadavky musí byť platný JSON');
        }
        body = parseSchema(options.body, bodyRaw, 'body');
      }

      // Parse params
      const paramsRaw = ctx.params ? await Promise.resolve(ctx.params) : ({} as TParams);
      const params = parseSchema(options.params, paramsRaw, 'params');

      // Resolve current user (default: required)
      const requireAuth = options.requireAuth !== false || (options.roles && options.roles.length > 0);
      let user: CurrentUser | null = null;
      if (requireAuth) {
        // Inline import to avoid circular dependency
        const { getUserFromHeaders, requireRole } = await import('@/lib/auth/session');
        user = getUserFromHeaders(request.headers);
        if (options.roles && options.roles.length > 0) {
          requireRole(user, ...options.roles);
        }
      }

      const data = await options.handler({ request, query, body, params, log: log.child({ userId: user?.id }), requestId, user });

      // Success envelope
      return NextResponse.json(
        { ok: true, ...((data as Record<string, unknown>) ?? {}) },
        { headers: { 'x-request-id': requestId } },
      );
    } catch (error) {
      if (error instanceof HttpError) {
        log.warn({ status: error.status, msg: error.message }, 'request failed');
        return NextResponse.json(
          { ok: false, error: error.message, details: error.details },
          { status: error.status, headers: { 'x-request-id': requestId } },
        );
      }

      log.error({ err: error }, 'unhandled error in route');
      return NextResponse.json(
        { ok: false, error: 'Interná chyba servera' },
        { status: 500, headers: { 'x-request-id': requestId } },
      );
    }
  };
}
