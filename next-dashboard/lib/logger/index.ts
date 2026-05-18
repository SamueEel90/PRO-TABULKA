/**
 * Centralized structured logger.
 *
 * Pino emits JSON logs that work natively on Vercel (Log Drains)
 * and GCP Cloud Logging — no changes needed when migrating clouds.
 *
 * Use:
 *   import { logger } from '@/lib/logger';
 *   logger.info({ userId: '1020' }, 'Dashboard loaded');
 *   logger.error({ err }, 'Save failed');
 *
 * For request-scoped logging use `child`:
 *   const log = logger.child({ requestId, userId });
 *   log.info('request handled');
 */

import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

// NOTE: We intentionally do NOT use pino's `transport` option (e.g. pino-pretty).
// pino-pretty spawns a worker thread via `thread-stream`, and Next.js's bundler
// does not include the worker source in `.next/server/vendor-chunks/lib/worker.js`,
// which causes MODULE_NOT_FOUND + "the worker has exited" crashes on every log
// call. JSON to stdout is safe in both dev and prod (Vercel Log Drains parse JSON).
export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  base: {
    env: process.env.NODE_ENV,
    service: 'pro-dashboard',
  },
  // Redact sensitive fields automatically
  redact: {
    paths: [
      'password',
      'token',
      'cookie',
      'authorization',
      '*.password',
      '*.token',
      'req.headers.cookie',
      'req.headers.authorization',
    ],
    censor: '[REDACTED]',
  },
});

/**
 * Build a request-scoped child logger with a unique request ID.
 * Use in route handlers and pass it to services.
 */
export function buildRequestLogger(requestId: string, extra?: Record<string, unknown>) {
  return logger.child({ requestId, ...extra });
}

export type Logger = typeof logger;
