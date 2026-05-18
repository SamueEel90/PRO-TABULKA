/**
 * Password utilities — bcrypt hashing + temp password generation.
 *
 * Used by the user admin endpoints to create accounts and reset passwords.
 */

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

// Cost factor 12 ≈ 250ms per hash on a modern server — significantly slower
// brute force without making interactive login feel sluggish. Existing hashes
// at cost 10 keep working (bcrypt.compare reads cost from the hash itself).
const BCRYPT_ROUNDS = 12;

/** Minimum password length enforced by admin endpoints when setting passwords. */
export const MIN_PASSWORD_LENGTH = 10;

/** Hash a plaintext password for storage in User.passwordHash. */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Generate a memorable temporary password — easier for users to type than
 * pure base64 noise. 10 characters: lowercase letters + digits, no ambiguous
 * chars (no 0/O, 1/l/I).
 */
export function generateTempPassword(length = 10): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
