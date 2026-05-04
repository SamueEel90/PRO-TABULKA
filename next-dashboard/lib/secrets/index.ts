/**
 * Secrets / environment variable accessor.
 *
 * Centralized so we can later swap process.env for GCP Secret Manager
 * without touching call sites.
 *
 * Use:
 *   import { secrets } from '@/lib/secrets';
 *   const url = secrets.required('DATABASE_URL');
 *   const opt = secrets.optional('LOG_LEVEL', 'info');
 */

class SecretsAccessor {
  required(key: string): string {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      throw new Error(`Missing required env var: ${key}`);
    }
    return value;
  }

  optional(key: string, defaultValue = ''): string {
    return process.env[key]?.trim() || defaultValue;
  }

  bool(key: string, defaultValue = false): boolean {
    const value = process.env[key]?.trim().toLowerCase();
    if (value === undefined) return defaultValue;
    return value === '1' || value === 'true' || value === 'yes';
  }
}

export const secrets = new SecretsAccessor();
