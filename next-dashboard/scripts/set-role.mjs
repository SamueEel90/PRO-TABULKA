// Usage:
//   node scripts/set-role.mjs <email> <ROLE>
//
// Examples:
//   node scripts/set-role.mjs testvkl5@gmail.sk ADMIN
//   node scripts/set-role.mjs sk1020hl@kaufland.sk VOD

import { PrismaClient } from '@prisma/client';

const ALLOWED_ROLES = ['VOD', 'VKL', 'GF', 'ADMIN'];

async function main() {
  const [, , emailArg, roleArg] = process.argv;
  if (!emailArg || !roleArg) {
    console.error('Usage: node scripts/set-role.mjs <email> <ROLE>');
    process.exit(1);
  }

  const email = String(emailArg).trim().toLowerCase();
  const role = String(roleArg).trim().toUpperCase();

  if (!ALLOWED_ROLES.includes(role)) {
    console.error(`Invalid role "${role}". Allowed: ${ALLOWED_ROLES.join(', ')}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { role },
      select: { id: true, email: true, role: true, name: true },
    });
    console.log('Updated:', user);
    console.log('\n→ Sign out and sign in again so the new role is in your JWT.');
  } catch (err) {
    if (err.code === 'P2025') {
      console.error(`No user found with email: ${email}`);
    } else {
      console.error('Failed:', err.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
