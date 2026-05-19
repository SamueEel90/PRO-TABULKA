/**
 * Auth.js v5 configuration — email + password (bcrypt) only.
 *
 * Users are pre-provisioned by ADMIN (no self-register, no Google OAuth).
 * Password is stored as a bcrypt hash in the User.passwordHash column,
 * which lives in Google Sheets and is mirrored into the local SQLite cache.
 *
 * Strategy: JWT sessions (stateless, fast, works on edge runtime).
 * The JWT carries role + scope so no DB lookup is needed per request.
 *
 * To create the first admin:
 *   1. npm run hash-password -- "yourPassword"
 *   2. Paste the resulting hash into the User row's passwordHash column in Sheets.
 *   3. npm run sheets:pull (mirrors it into local cache).
 */

import bcrypt from 'bcryptjs';
import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { db, ensureCacheFresh } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { nowIso, pushUpdate } from '@/lib/sheets/write-through';

// ── Login rate limiting ────────────────────────────────────────────────────
//
// In-memory per-email throttle. Lives at module scope so it persists across
// requests within the same lambda. Lossy across cold starts and multiple
// concurrent lambdas — an attacker hitting many cold lambdas can bypass it,
// but raises the bar significantly vs. no limit at all. Combined with
// bcrypt cost 12, brute-force becomes impractical.
//
// For stronger guarantees, persist failed attempts to the User row
// (failedLoginAttempts + lockedUntil columns) — see CLAUDE.md TODOs.

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

type AttemptRecord = { count: number; firstAt: number };
const loginAttempts = new Map<string, AttemptRecord>();

function isRateLimited(email: string): boolean {
  const rec = loginAttempts.get(email);
  if (!rec) return false;
  if (Date.now() - rec.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(email);
    return false;
  }
  return rec.count >= LOGIN_MAX_ATTEMPTS;
}

function recordFailedAttempt(email: string): void {
  const now = Date.now();
  const rec = loginAttempts.get(email);
  if (!rec || now - rec.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(email, { count: 1, firstAt: now });
    return;
  }
  rec.count += 1;
}

function clearAttempts(email: string): void {
  loginAttempts.delete(email);
}

// ── Type augmentation: add our domain fields onto the session/JWT ──────────

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      role: 'VOD' | 'VKL' | 'GF' | 'GL' | 'ADMIN';
      primaryStoreId: string | null;
      vklName: string | null;
      gfName: string | null;
    } & DefaultSession['user'];
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    userId: string;
    role: 'VOD' | 'VKL' | 'GF' | 'GL' | 'ADMIN';
    primaryStoreId: string | null;
    vklName: string | null;
    gfName: string | null;
  }
}

// ── Auth.js exports ─────────────────────────────────────────────────────────

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      id: 'credentials',
      name: 'Email + heslo',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Heslo', type: 'password' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || '').trim().toLowerCase();
        const password = String(credentials?.password || '');

        if (!email || !password) {
          return null;
        }

        if (isRateLimited(email)) {
          logger.warn({ email, max: LOGIN_MAX_ATTEMPTS, windowMs: LOGIN_WINDOW_MS },
            'login rejected: rate limit exceeded');
          return null;
        }

        // Cold lambdas have no SQLite cache yet — rebuild from Sheets before
        // any DB read. Without this the findUnique below throws and NextAuth
        // surfaces it as a `Configuration` error on the login page.
        try {
          await ensureCacheFresh();
        } catch (err) {
          logger.error({ err, email }, 'login failed: cache rebuild error');
          return null;
        }

        const user = await db.user.findUnique({ where: { email } });
        if (!user) {
          recordFailedAttempt(email);
          logger.warn({ email }, 'login rejected: user not found');
          return null;
        }
        if (!user.active) {
          recordFailedAttempt(email);
          logger.warn({ email }, 'login rejected: user inactive');
          return null;
        }
        if (!user.passwordHash) {
          recordFailedAttempt(email);
          logger.warn({ email }, 'login rejected: no passwordHash set');
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          recordFailedAttempt(email);
          logger.warn({ email }, 'login rejected: bad password');
          return null;
        }

        clearAttempts(email);
        return {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    /**
     * jwt callback — runs whenever a JWT is created or updated.
     * On first sign-in we enrich the token with role + scope from DB.
     */
    async jwt({ token, user }) {
      if (user?.email) {
        try {
          await ensureCacheFresh();
        } catch (err) {
          logger.warn({ err, email: user.email }, 'jwt callback: cache refresh failed');
        }
        const dbUser = await db.user.findUnique({ where: { email: user.email } });
        if (dbUser) {
          token.userId = dbUser.id;
          token.role = dbUser.role as 'VOD' | 'VKL' | 'GF' | 'GL' | 'ADMIN';
          token.primaryStoreId = dbUser.primaryStoreId;
          token.vklName = dbUser.vklName;
          token.gfName = dbUser.gfName;
          token.email = dbUser.email;
          token.name = dbUser.name;

          // Track last login (best-effort, both Sheets and cache)
          const now = nowIso();
          try {
            await pushUpdate('User', {
              id: dbUser.id,
              email: dbUser.email,
              passwordHash: dbUser.passwordHash,
              name: dbUser.name,
              role: dbUser.role,
              gfName: dbUser.gfName,
              vklName: dbUser.vklName,
              primaryStoreId: dbUser.primaryStoreId,
              active: dbUser.active,
              lastLoginAt: now,
              createdAt: dbUser.createdAt.toISOString(),
              updatedAt: now,
            });
            await db.user.update({
              where: { id: dbUser.id },
              data: { lastLoginAt: new Date(now), updatedAt: new Date(now) },
            });
          } catch (err) {
            logger.warn({ err, email: dbUser.email }, 'failed to update lastLoginAt');
          }
        }
      }
      return token;
    },

    /**
     * session callback — shapes the session object returned to the client.
     */
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = String(token.userId || '');
        session.user.role = (token.role as 'VOD' | 'VKL' | 'GF' | 'GL' | 'ADMIN');
        session.user.primaryStoreId = (token.primaryStoreId as string | null) ?? null;
        session.user.vklName = (token.vklName as string | null) ?? null;
        session.user.gfName = (token.gfName as string | null) ?? null;
        session.user.email = String(token.email || '');
      }
      return session;
    },
  },
  trustHost: true,
});

