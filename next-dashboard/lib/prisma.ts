import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function getDatasourceUrl() {
  const databaseUrl = process.env.DATABASE_URL;

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
      url: getDatasourceUrl(),
    },
  },
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
