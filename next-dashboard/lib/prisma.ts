import { PrismaClient } from '@prisma/client';
import path from 'node:path';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const datasourceUrl = getDatasourceUrl();

if (datasourceUrl && process.env.DATABASE_URL !== datasourceUrl) {
  process.env.DATABASE_URL = datasourceUrl;
}

function getDatasourceUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  const isVercelRuntime = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

  if (!isVercelRuntime && (!databaseUrl || !databaseUrl.startsWith('file:'))) {
    const sqlitePath = path.join(process.cwd(), 'prisma', 'dev.db').replace(/\\/g, '/');
    return `file:${sqlitePath}`;
  }

  if (!databaseUrl) {
    return undefined;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    return databaseUrl;
  }

  const isSupabasePooler = parsedUrl.hostname.includes('.pooler.supabase.com') || parsedUrl.port === '6543';
  if (!isSupabasePooler) {
    return databaseUrl;
  }

  if (!parsedUrl.searchParams.has('pgbouncer')) {
    parsedUrl.searchParams.set('pgbouncer', 'true');
  }

  if (!parsedUrl.searchParams.has('connection_limit')) {
    parsedUrl.searchParams.set('connection_limit', '1');
  }

  return parsedUrl.toString();
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: datasourceUrl,
    },
  },
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
