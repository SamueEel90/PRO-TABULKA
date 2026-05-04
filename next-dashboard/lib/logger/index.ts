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

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  base: {
    env: process.env.NODE_ENV,
    service: 'pro-dashboard',
  },
  // Pretty-print only in dev; production stays JSON for log aggregators
  transport: !isProd
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname,service,env',
        },
      }
    : undefined,
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
