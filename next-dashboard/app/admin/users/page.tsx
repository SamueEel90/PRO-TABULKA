import Link from 'next/link';

import { UsersAdmin } from './users-admin';

export const dynamic = 'force-dynamic';

export default function AdminUsersPage() {
  return (
    <main className="page">
      <div className="topbar">
        <div className="brand">
          <span className="kicker">ADMIN</span>
          <h1>Správa používateľov</h1>
          <p>Pridanie nových účtov a reset hesiel. Heslá sa zobrazia raz po vytvorení / resete — skopíruj si ich.</p>
        </div>
        <div className="actions">
          <Link className="link-button" href="/upload">Import dát</Link>
          <Link className="link-button" href="/">Späť</Link>
        </div>
      </div>

      <UsersAdmin />
    </main>
  );
}
