import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe auth config — no DB imports, no Prisma.
 * Used by middleware (edge runtime) to verify JWT sessions.
 * Full auth config (with DB callbacks) is in auth.ts.
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = String(token.userId || '');
        session.user.role = token.role as 'VOD' | 'VKL' | 'GF' | 'ADMIN';
        session.user.primaryStoreId = (token.primaryStoreId as string | null) ?? null;
        session.user.vklName = (token.vklName as string | null) ?? null;
        session.user.gfName = (token.gfName as string | null) ?? null;
        session.user.email = String(token.email || '');
      }
      return session;
    },
  },
  providers: [],
  trustHost: true,
} satisfies NextAuthConfig;
