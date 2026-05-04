'use client';

import { SessionProvider } from 'next-auth/react';

/**
 * Top-level client providers (currently just Auth.js SessionProvider).
 * Wraps children so any client component can call useSession().
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
