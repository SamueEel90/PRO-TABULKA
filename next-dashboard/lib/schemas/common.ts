/**
 * Shared Zod primitives used across multiple endpoints.
 * Keep schemas small and composable.
 */

import { z } from 'zod';

export const Role = z.enum(['VOD', 'VKL', 'GF', 'ADMIN']);
export type Role = z.infer<typeof Role>;

export const ScopeType = z.enum(['STORE', 'AGGREGATE']);
export type ScopeType = z.infer<typeof ScopeType>;

/** Email restricted to @kaufland.sk domain. */
export const KauflandEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email('Neplatný email')
  .refine((email) => email.endsWith('@kaufland.sk'), {
    message: 'Povolené sú len kaufland.sk emaily',
  });

/** Store ID — 4-digit numeric string used in legacy data. */
export const StoreId = z
  .string()
  .trim()
  .regex(/^\d{4}$/, 'Store ID musí byť 4-ciferné číslo');

/** Note/task scope key, e.g. "STORE|1020" or "AGGREGATE|VKL|VKL Bratislava". */
export const ScopeKey = z
  .string()
  .min(1, 'scopeKey je povinný')
  .max(200);

export const NonEmptyString = z.string().trim().min(1);

/** Common pagination params. */
export const Pagination = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
