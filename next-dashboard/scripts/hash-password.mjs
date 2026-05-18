// Generate a bcrypt hash for a password.
//
// Usage:
//   npm run hash-password -- "yourPassword"
//   node scripts/hash-password.mjs "yourPassword"
//
// Paste the resulting hash into the User row's passwordHash column in the
// Google Sheet, then run `npm run sheets:pull` to mirror it into local cache.

import bcrypt from 'bcryptjs';

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.mjs <password>');
  console.error('       npm run hash-password -- <password>');
  process.exit(1);
}

if (password.length < 6) {
  console.error('Heslo musí mať aspoň 6 znakov.');
  process.exit(1);
}

const SALT_ROUNDS = 10;
const hash = await bcrypt.hash(password, SALT_ROUNDS);

console.log('');
console.log('bcrypt hash:');
console.log(hash);
console.log('');
console.log('→ Skopíruj do passwordHash stĺpca v User tabe v Sheete.');
console.log('→ Potom spusti: npm run sheets:pull');
