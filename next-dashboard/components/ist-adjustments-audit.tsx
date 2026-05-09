'use client';

import { useEffect, useMemo, useState } from 'react';

type AuditRequest = {
  id: string;
  storeId: string;
  metricCode: string;
  monthLabel: string;
  oldValue: number;
  newValue: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  requestedByName: string;
  vklName: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  store?: { id: string; name: string; vklName: string | null; gfName: string | null } | null;
};

const dateFormatter = new Intl.DateTimeFormat('sk-SK', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const numberFormatter = new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 2 });

function formatDate(value: string | null) {
  if (!value) return '';
  try { return dateFormatter.format(new Date(value)); } catch { return value; }
}

export function IstAdjustmentsAudit() {
  const [requests, setRequests] = useState<AuditRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [filterGf, setFilterGf] = useState('');
  const [filterVkl, setFilterVkl] = useState('');
  const [filterStore, setFilterStore] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch('/api/ist-adjustments')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setRequests(data.requests || []);
        else setError(data.error || 'Chyba pri načítaní.');
      })
      .catch(() => { if (!cancelled) setError('Chyba siete.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const gfOptions = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => { if (r.store?.gfName) set.add(r.store.gfName); });
    return Array.from(set).sort();
  }, [requests]);

  const vklOptions = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      const vkl = r.vklName || r.store?.vklName;
      if (vkl) set.add(vkl);
    });
    return Array.from(set).sort();
  }, [requests]);

  const filtered = useMemo(() => {
    const fromMs = filterFrom ? new Date(filterFrom).getTime() : null;
    const toMs = filterTo ? new Date(filterTo).getTime() + 24 * 60 * 60 * 1000 : null;
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterGf && r.store?.gfName !== filterGf) return false;
      if (filterVkl) {
        const vkl = r.vklName || r.store?.vklName || '';
        if (vkl !== filterVkl) return false;
      }
      if (filterStore) {
        const hay = `${r.storeId} ${r.store?.name || ''}`.toLowerCase();
        if (!hay.includes(filterStore.toLowerCase())) return false;
      }
      if (fromMs || toMs) {
        const t = new Date(r.createdAt).getTime();
        if (fromMs && t < fromMs) return false;
        if (toMs && t >= toMs) return false;
      }
      if (q) {
        const hay = `${r.metricCode} ${r.monthLabel} ${r.reason} ${r.decisionNote || ''} ${r.requestedByName} ${r.decidedByName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requests, filterStatus, filterGf, filterVkl, filterStore, filterFrom, filterTo, search]);

  const counts = useMemo(() => ({
    total: filtered.length,
    pending: filtered.filter((r) => r.status === 'pending').length,
    approved: filtered.filter((r) => r.status === 'approved').length,
    rejected: filtered.filter((r) => r.status === 'rejected').length,
  }), [filtered]);

  const topStores = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    filtered.forEach((r) => {
      const key = r.storeId;
      const existing = map.get(key);
      if (existing) existing.count++;
      else map.set(key, { id: r.storeId, name: r.store?.name || r.storeId, count: 1 });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [filtered]);

  const resetFilters = () => {
    setFilterStatus('all');
    setFilterGf('');
    setFilterVkl('');
    setFilterStore('');
    setFilterFrom('');
    setFilterTo('');
    setSearch('');
  };

  const exportCsv = () => {
    const header = ['createdAt', 'status', 'gf', 'vkl', 'storeId', 'storeName', 'metricCode', 'monthLabel', 'oldValue', 'newValue', 'requestedBy', 'decidedBy', 'decidedAt', 'reason', 'decisionNote'];
    const rows = filtered.map((r) => [
      r.createdAt,
      r.status,
      r.store?.gfName || '',
      r.vklName || r.store?.vklName || '',
      r.storeId,
      r.store?.name || '',
      r.metricCode,
      r.monthLabel,
      String(r.oldValue),
      String(r.newValue),
      r.requestedByName,
      r.decidedByName || '',
      r.decidedAt || '',
      r.reason.replace(/[\r\n]+/g, ' '),
      (r.decisionNote || '').replace(/[\r\n]+/g, ' '),
    ]);
    const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(["﻿" + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ist-adjustments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <div className="brand">
        <span className="kicker">Audit</span>
        <h2>Žiadosti o úpravu IST hodnôt</h2>
        <p className="note">Read-only prehľad všetkých žiadostí naprieč filiálkami. Filtruj podľa stavu, GF, VKL, filiálky alebo dátumu.</p>
      </div>

      <div className="ist-audit-summary">
        <div className="ist-audit-stat"><span className="ist-audit-stat-num">{counts.total}</span><span className="ist-audit-stat-label">Celkom</span></div>
        <div className="ist-audit-stat ist-audit-stat--pending"><span className="ist-audit-stat-num">{counts.pending}</span><span className="ist-audit-stat-label">Čaká</span></div>
        <div className="ist-audit-stat ist-audit-stat--approved"><span className="ist-audit-stat-num">{counts.approved}</span><span className="ist-audit-stat-label">Schválené</span></div>
        <div className="ist-audit-stat ist-audit-stat--rejected"><span className="ist-audit-stat-num">{counts.rejected}</span><span className="ist-audit-stat-label">Zamietnuté</span></div>
        {topStores.length ? (
          <div className="ist-audit-top">
            <span className="ist-audit-top-label">Najviac úprav:</span>
            {topStores.map((s) => (
              <span key={s.id} className="ist-audit-top-store">{s.name} <strong>({s.count})</strong></span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="ist-audit-filters">
        <label className="ist-audit-filter">
          <span>Stav</span>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'pending' | 'approved' | 'rejected')}>
            <option value="all">Všetky</option>
            <option value="pending">Čaká</option>
            <option value="approved">Schválené</option>
            <option value="rejected">Zamietnuté</option>
          </select>
        </label>
        <label className="ist-audit-filter">
          <span>GF</span>
          <select value={filterGf} onChange={(e) => setFilterGf(e.target.value)}>
            <option value="">— všetci —</option>
            {gfOptions.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="ist-audit-filter">
          <span>VKL</span>
          <select value={filterVkl} onChange={(e) => setFilterVkl(e.target.value)}>
            <option value="">— všetci —</option>
            {vklOptions.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="ist-audit-filter">
          <span>Filiálka</span>
          <input type="text" value={filterStore} onChange={(e) => setFilterStore(e.target.value)} placeholder="ID alebo názov" />
        </label>
        <label className="ist-audit-filter">
          <span>Od</span>
          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
        </label>
        <label className="ist-audit-filter">
          <span>Do</span>
          <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
        </label>
        <label className="ist-audit-filter ist-audit-filter--wide">
          <span>Hľadať v texte</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="metrika, mesiac, odôvodnenie…" />
        </label>
        <div className="ist-audit-filter-actions">
          <button type="button" className="ist-audit-button" onClick={resetFilters}>Vyčistiť</button>
          <button type="button" className="ist-audit-button ist-audit-button--primary" onClick={exportCsv} disabled={!filtered.length}>Export CSV</button>
        </div>
      </div>

      {error ? <div className="ist-audit-error">{error}</div> : null}

      <div className="ist-audit-table-wrap">
        {loading ? (
          <div className="ist-audit-empty">Načítavam…</div>
        ) : filtered.length === 0 ? (
          <div className="ist-audit-empty">Žiadne záznamy pre zvolené filtre.</div>
        ) : (
          <table className="ist-audit-table">
            <thead>
              <tr>
                <th>Dátum</th>
                <th>Stav</th>
                <th>GF</th>
                <th>VKL</th>
                <th>Filiálka</th>
                <th>Metrika</th>
                <th>Mesiac</th>
                <th style={{ textAlign: 'right' }}>Pôvodné</th>
                <th style={{ textAlign: 'right' }}>Nové</th>
                <th>VOD</th>
                <th>Odôvodnenie</th>
                <th>Rozhodol</th>
                <th>Poznámka</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const vkl = r.vklName || r.store?.vklName || '';
                const gf = r.store?.gfName || '';
                return (
                  <tr key={r.id} className={`ist-audit-row ist-audit-row--${r.status}`}>
                    <td>{formatDate(r.createdAt)}</td>
                    <td>
                      <span className={`ist-audit-status ist-audit-status--${r.status}`}>
                        {r.status === 'pending' ? 'Čaká' : r.status === 'approved' ? 'Schválené' : 'Zamietnuté'}
                      </span>
                    </td>
                    <td>{gf}</td>
                    <td>{vkl}</td>
                    <td>{r.store?.name || r.storeId} <span className="ist-audit-muted">({r.storeId})</span></td>
                    <td>{r.metricCode}</td>
                    <td>{r.monthLabel}</td>
                    <td style={{ textAlign: 'right' }}>{numberFormatter.format(r.oldValue)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{numberFormatter.format(r.newValue)}</td>
                    <td>{r.requestedByName}</td>
                    <td className="ist-audit-cell-text">{r.reason}</td>
                    <td>
                      {r.decidedByName ? (
                        <>
                          {r.decidedByName}
                          {r.decidedAt ? <div className="ist-audit-muted">{formatDate(r.decidedAt)}</div> : null}
                        </>
                      ) : '—'}
                    </td>
                    <td className="ist-audit-cell-text">{r.decisionNote || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
