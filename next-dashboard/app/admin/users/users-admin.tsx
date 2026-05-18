'use client';

import { useCallback, useEffect, useState } from 'react';

type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  gfName: string | null;
  vklName: string | null;
  primaryStoreId: string | null;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

type CreateForm = {
  email: string;
  name: string;
  role: 'VOD' | 'VKL' | 'GF' | 'GL' | 'ADMIN';
  primaryStoreId: string;
  gfName: string;
  vklName: string;
  password: string;
};

const EMPTY_FORM: CreateForm = {
  email: '',
  name: '',
  role: 'VOD',
  primaryStoreId: '',
  gfName: '',
  vklName: '',
  password: '',
};

export function UsersAdmin() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [revealed, setRevealed] = useState<{ email: string; password: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Načítanie zlyhalo.');
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načítanie zlyhalo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Vytvorenie zlyhalo.');
      setRevealed({ email: form.email, password: data.tempPassword });
      setForm(EMPTY_FORM);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vytvorenie zlyhalo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (user: User) => {
    const custom = prompt(
      `Reset hesla pre ${user.email}.\n\nZadaj nové heslo (min. 6 znakov), alebo nechaj prázdne pre auto-generované:`,
      '',
    );
    if (custom === null) return; // cancelled
    if (custom && custom.length < 6) {
      setError('Heslo musí mať aspoň 6 znakov.');
      return;
    }
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password', password: custom || undefined }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Reset zlyhal.');
      setRevealed({ email: user.email, password: data.tempPassword });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset zlyhal.');
    }
  };

  const handleToggleActive = async (user: User) => {
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-active' }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Zmena zlyhala.');
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zmena zlyhala.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {error ? <div style={errorStyle}>{error}</div> : null}

      {revealed ? (
        <div style={revealStyle}>
          <strong>Heslo pre {revealed.email}:</strong>
          <code style={codeStyle}>{revealed.password}</code>
          <p style={{ margin: '8px 0 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Skopíruj a pošli userovi — po refreshi sa už nezobrazí.
          </p>
          <button type="button" onClick={() => setRevealed(null)} style={dismissStyle}>
            Zatvoriť
          </button>
        </div>
      ) : null}

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Pridať nového usera</h2>
        <form onSubmit={handleCreate} style={formStyle}>
          <Field label="Email *">
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} placeholder="meno@kaufland.sk" />
          </Field>
          <Field label="Meno">
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="Ján Novák" />
          </Field>
          <Field label="Rola *">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as CreateForm['role'] })} style={inputStyle}>
              <option value="VOD">VOD</option>
              <option value="VKL">VKL</option>
              <option value="GF">GF</option>
              <option value="GL">GL</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </Field>
          <Field label="Primary Store ID">
            <input type="text" value={form.primaryStoreId} onChange={(e) => setForm({ ...form, primaryStoreId: e.target.value })} style={inputStyle} placeholder="1020" />
          </Field>
          <Field label="VKL meno">
            <input type="text" value={form.vklName} onChange={(e) => setForm({ ...form, vklName: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="GF meno">
            <input type="text" value={form.gfName} onChange={(e) => setForm({ ...form, gfName: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Heslo (prázdne = vygenerovať)">
            <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={inputStyle} placeholder="min. 6 znakov" autoComplete="new-password" />
          </Field>

          <div style={{ gridColumn: '1 / -1' }}>
            <button type="submit" disabled={submitting} className="link-button" style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '8px 16px', fontWeight: 600, cursor: submitting ? 'wait' : 'pointer' }}>
              {submitting ? 'Vytváram…' : 'Vytvoriť usera + vygenerovať heslo'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Existujúci useri ({users.length})</h2>
        {loading ? (
          <p>Načítavam…</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Meno</th>
                  <th style={thStyle}>Rola</th>
                  <th style={thStyle}>Predajňa</th>
                  <th style={thStyle}>VKL</th>
                  <th style={thStyle}>GF</th>
                  <th style={thStyle}>Aktívny</th>
                  <th style={thStyle}>Posledné prihlásenie</th>
                  <th style={thStyle}>Akcie</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={tdStyle}>{u.email}</td>
                    <td style={tdStyle}>{u.name || '—'}</td>
                    <td style={tdStyle}>{u.role}</td>
                    <td style={tdStyle}>{u.primaryStoreId || '—'}</td>
                    <td style={tdStyle}>{u.vklName || '—'}</td>
                    <td style={tdStyle}>{u.gfName || '—'}</td>
                    <td style={tdStyle}>{u.active ? '✓' : '—'}</td>
                    <td style={tdStyle}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('sk-SK') : '—'}</td>
                    <td style={tdStyle}>
                      <button type="button" onClick={() => handleResetPassword(u)} style={actionBtnStyle}>
                        Reset hesla
                      </button>
                      <button type="button" onClick={() => handleToggleActive(u)} style={{ ...actionBtnStyle, marginLeft: 6 }}>
                        {u.active ? 'Deaktivovať' : 'Aktivovať'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14, background: 'var(--surface, white)', color: 'var(--text, #222)' };
const formStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)' };
const actionBtnStyle: React.CSSProperties = { padding: '4px 10px', fontSize: 12, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface, white)', color: 'var(--text, #222)', cursor: 'pointer' };
const errorStyle: React.CSSProperties = { padding: 12, background: '#fee', border: '1px solid #c33', borderRadius: 6, color: '#c33' };
const revealStyle: React.CSSProperties = { padding: 16, background: '#efe', border: '2px solid #2a7', borderRadius: 8 };
const codeStyle: React.CSSProperties = { display: 'inline-block', margin: '4px 0 0 8px', padding: '4px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'monospace', fontSize: 16, fontWeight: 700 };
const dismissStyle: React.CSSProperties = { marginTop: 12, padding: '6px 16px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface, white)', color: 'var(--text, #222)', cursor: 'pointer', fontSize: 13, fontWeight: 600 };
