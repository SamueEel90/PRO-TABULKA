/**
 * @deprecated requireAdminSecret is no longer needed.
 * Middleware (middleware.ts) now enforces ADMIN role via session for all
 * /api/admin/* and /api/import/* routes. Individual route handlers don't
 * need to re-check the secret.
 *
 * This function is kept as a no-op to avoid changing every call site at once.
 * It will be removed in the Etapa 2 service refactor.
 */
export function requireAdminSecret(_request: unknown): null {
  return null;
}
