const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [userCount, storeCount, sampleUsers, sampleStores] = await Promise.all([
    prisma.user.count(),
    prisma.store.count(),
    prisma.user.findMany({ take: 10, orderBy: { createdAt: 'asc' } }),
    prisma.store.findMany({ take: 10, orderBy: { id: 'asc' }, select: { id: true, name: true, gfName: true, vklName: true } }),
  ]);

  console.log(JSON.stringify({ userCount, storeCount, sampleUsers, sampleStores }, null, 2));
}

main().finally(() => prisma.$disconnect());
