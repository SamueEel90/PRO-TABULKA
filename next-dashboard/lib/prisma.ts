/**
 * @deprecated Use `import { db } from '@/lib/db/client'` instead.
 * This file is kept as a re-export for backward compatibility with legacy code.
 * New code MUST import from `@/lib/db/client`.
 */

export { db as prisma } from './db/client';
