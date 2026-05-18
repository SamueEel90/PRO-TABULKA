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

import { db } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { nowIso, pushUpdate } from '@/lib/sheets/write-through';

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

        const user = await db.user.findUnique({ where: { email } });
        if (!user) {
          logger.warn({ email }, 'login rejected: user not found');
          return null;
        }
        if (!user.active) {
          logger.warn({ email }, 'login rejected: user inactive');
          return null;
        }
        if (!user.passwordHash) {
          logger.warn({ email }, 'login rejected: no passwordHash set');
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          logger.warn({ email }, 'login rejected: bad password');
          return null;
        }

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

