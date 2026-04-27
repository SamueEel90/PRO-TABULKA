const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const metrics = await prisma.metric.findMany({ orderBy: { displayName: 'asc' }, select: { code: true, displayName: true, unit: true, aggregation: true } });
  console.log(JSON.stringify(metrics, null, 2));
}

main().finally(() => prisma.$disconnect());
