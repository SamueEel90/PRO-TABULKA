/**
 * Auth.js v5 configuration.
 *
 * Two providers:
 *  - Google (production) — only @kaufland.sk emails are accepted, user must
 *    already exist in the User table (admin pre-provisions).
 *  - Credentials "DevLogin" — only enabled when DEV_LOGIN_ENABLED=true.
 *    Lets you sign in by typing any existing user's email — no password.
 *    Used during development/testing while Google OAuth is not configured.
 *
 * Strategy: JWT sessions (stateless, fast, works on edge runtime).
 * The JWT carries role/store info so we don't need a DB lookup per request.
 *
 * Use:
 *   import { auth, signIn, signOut } from '@/auth';
 *   const session = await auth();   // server components / route handlers
 */

import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';

import { db } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { secrets } from '@/lib/secrets';

const KAUFLAND_DOMAIN = '@kaufland.sk';
const isDevLoginEnabled = secrets.bool('DEV_LOGIN_ENABLED', process.env.NODE_ENV !== 'production');

// ── Type augmentation: add our domain fields onto the session/JWT ──────────

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      role: 'VOD' | 'VKL' | 'GF' | 'ADMIN';
      primaryStoreId: string | null;
      vklName: string | null;
      gfName: string | null;
    } & DefaultSession['user'];
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    userId: string;
    role: 'VOD' | 'VKL' | 'GF' | 'ADMIN';
    primaryStoreId: string | null;
    vklName: string | null;
    gfName: string | null;
  }
}

// ── Provider list (conditional) ─────────────────────────────────────────────

const providers = [];

// Google — only enabled when env vars are set (otherwise dev-only login is enough)
if (secrets.optional('GOOGLE_CLIENT_ID') && secrets.optional('GOOGLE_CLIENT_SECRET')) {
  providers.push(
    Google({
      clientId: secrets.required('GOOGLE_CLIENT_ID'),
      clientSecret: secrets.required('GOOGLE_CLIENT_SECRET'),
      authorization: {
        params: {
          // Only show kaufland.sk Google Workspace accounts in the picker
          hd: 'kaufland.sk',
          prompt: 'select_account',
        },
      },
    }),
  );
}

// Dev login — bypass authentication during development
if (isDevLoginEnabled) {
  providers.push(
    Credentials({
      id: 'dev-login',
      name: 'Dev Login (development only)',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'sk1020hl@kaufland.sk' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || '').trim().toLowerCase();
        if (!email) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user) {
          logger.warn({ email }, 'dev login: user not in DB');
          return null;
        }
        if (!user.active) {
          logger.warn({ email }, 'dev login: user inactive');
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
        };
      },
    }),
  );
}

// ── Auth.js exports ─────────────────────────────────────────────────────────

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    /**
     * signIn callback — runs every time someone tries to authenticate.
     * Reject anyone not in the User table (admin pre-provisions accounts).
     */
    async signIn({ user, account }) {
      const email = (user.email || '').toLowerCase().trim();
      if (!email) return false;

      // Google: enforce kaufland.sk domain in addition to OAuth's `hd` param
      if (account?.provider === 'google' && !email.endsWith(KAUFLAND_DOMAIN)) {
        logger.warn({ email, provider: account.provider }, 'sign in rejected: non-kaufland email');
        return false;
      }

      const dbUser = await db.user.findUnique({ where: { email } });
      if (!dbUser) {
        logger.warn({ email }, 'sign in rejected: user not pre-provisioned');
        return false;
      }
      if (!dbUser.active) {
        logger.warn({ email }, 'sign in rejected: user inactive');
        return false;
      }

      // Track last login timestamp
      await db.user.update({
        where: { id: dbUser.id },
        data: { lastLoginAt: new Date() },
      }).catch(() => { /* best effort */ });

      return true;
    },

    /**
     * jwt callback — runs whenever a JWT is created or updated.
     * On first sign-in we enrich the token with role + scope from DB.
     */
    async jwt({ token, user }) {
      // First sign-in: `user` is set, look up DB row to enrich token
      if (user?.email) {
        const dbUser = await db.user.findUnique({ where: { email: user.email } });
        if (dbUser) {
          token.userId = dbUser.id;
          token.role = dbUser.role as 'VOD' | 'VKL' | 'GF' | 'ADMIN';
          token.primaryStoreId = dbUser.primaryStoreId;
          token.vklName = dbUser.vklName;
          token.gfName = dbUser.gfName;
          token.email = dbUser.email;
          token.name = dbUser.name;
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
        session.user.role = (token.role as 'VOD' | 'VKL' | 'GF' | 'ADMIN');
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
