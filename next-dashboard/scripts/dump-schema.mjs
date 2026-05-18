// Dump current SQLite schema from prisma/dev.db and write as a TS constant.
//
// Output: lib/db/init-schema.ts (committed) — used at runtime on Vercel to
// initialize an empty /tmp/cache.db with the correct schema.
//
// Usage:
//   npm run db:dump-schema
//
// Run this after any change to prisma/schema.prisma (followed by `prisma db push`).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

function loadEnv() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const envPath = path.join(here, '..', '.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {}
}
loadEnv();

const prisma = new PrismaClient();

try {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT sql FROM sqlite_master WHERE type IN ("table", "index") AND sql IS NOT NULL ORDER BY rootpage',
  );
  const stmts = rows.map(r => r.sql + ';').join('\n\n');

  // Escape for template literal: backticks, ${, backslashes
  const escaped = stmts
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');

  const out = `/**
 * Auto-generated SQLite schema dump. Regenerate with: npm run db:dump-schema
 *
 * Used by lib/db/bootstrap.ts to initialize an empty /tmp/cache.db on Vercel
 * cold start. Bundled into the deploy artifact as plain code (no fs reads).
 */
export const INIT_SCHEMA_SQL = \`${escaped}\`;
`;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.join(here, '..', 'lib', 'db', 'init-schema.ts');
  writeFileSync(outPath, out, 'utf-8');
  console.log(`Wrote ${rows.length} statements to lib/db/init-schema.ts (${out.length} bytes)`);
} finally {
  await prisma.$disconnect();
}
