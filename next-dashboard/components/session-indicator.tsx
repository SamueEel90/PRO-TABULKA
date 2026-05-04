'use client';

import { signOut, useSession } from 'next-auth/react';

export function SessionIndicator() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <div className="session-indicator session-indicator--loading">Načítavam…</div>;
  }

  if (!session?.user) {
    return null;
  }

  const handleLogout = () => {
    void signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="session-indicator">
      <div className="session-indicator-info">
        <strong>{session.user.email}</strong>
        <span className="session-indicator-meta">
          {session.user.role}
          {session.user.primaryStoreId ? ` · ${session.user.primaryStoreId}` : ''}
          {session.user.vklName ? ` · ${session.user.vklName}` : ''}
          {session.user.gfName ? ` · ${session.user.gfName}` : ''}
        </span>
      </div>
      <button type="button" className="session-indicator-logout" onClick={handleLogout}>
        Odhlásiť
      </button>
    </div>
  );
}
