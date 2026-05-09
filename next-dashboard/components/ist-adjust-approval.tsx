'use client';

import { useCallback, useEffect, useState } from 'react';

type AdjustmentRequest = {
  id: string;
  storeId: string;
  metricCode: string;
  monthId: string;
  monthLabel: string;
  oldValue: number;
  newValue: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  requestedByName: string;
  createdAt: string;
  decidedByName?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  store?: { id: string; name: string } | null;
};

type Props = {
  vklName: string;
  currentRole: string;
};

const dateFormatter = new Intl.DateTimeFormat('sk-SK', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function formatNumber(n: number) {
  return new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 2 }).format(n);
}

export function IstAdjustApproval({ vklName, currentRole }: Props) {
  const [requests, setRequests] = useState<AdjustmentRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const canDecide = currentRole === 'VKL' || currentRole === 'ADMIN';

  const fetchRequests = useCallback(async () => {
    if (!vklName) return;
    try {
      const res = await fetch(`/api/ist-adjustments?vklName=${encodeURIComponent(vklName)}`);
      const data = await res.json();
      if (data.ok) setRequests(data.requests || []);
    } catch { /* ignore */ }
  }, [vklName]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);
  useEffect(() => {
    const handler = () => fetchRequests();
    window.addEventListener('pro-dashboard:ist-adjustments-changed', handler);
    return () => window.removeEventListener('pro-dashboard:ist-adjustments-changed', handler);
  }, [fetchRequests]);

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const handleDecide = async (id: string, decision: 'approve' | 'reject') => {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`/api/ist-adjustments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, decisionNote: decisionNotes[id] || '' }),
      });
      const data = await res.json();
      if (data.ok) {
        await fetchRequests();
        window.dispatchEvent(new CustomEvent('pro-dashboard:ist-adjustments-changed'));
        window.dispatchEvent(new CustomEvent('pro-dashboard:activity-changed'));
      } else {
        setError(data.error || 'Chyba.');
      }
    } catch {
      setError('Chyba siete.');
    } finally {
      setBusyId(null);
    }
  };

  if (!vklName) return null;
  if (requests.length === 0 && !open) return null;

  if (!open) {
    return (
      <button
        type="button"
        className={`ist-approval-toggle${pendingCount > 0 ? ' ist-approval-toggle--has-pending' : ''}`}
        onClick={() => setOpen(true)}
        title="Žiadosti o úpravu IST"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        <span className="ist-approval-label">Úpravy IST</span>
        {pendingCount > 0 ? <span className="ist-approval-pill">{pendingCount} čaká</span> : null}
      </button>
    );
  }

  const visible = filter === 'pending' ? requests.filter((r) => r.status === 'pending') : requests;

  return (
    <div className="ist-approval-panel">
      <div className="ist-approval-header">
        <h4 className="ist-approval-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          Žiadosti o úpravu IST ({pendingCount} čaká)
        </h4>
        <button type="button" className="ist-approval-close" onClick={() => setOpen(false)} aria-label="Zavrieť">&times;</button>
      </div>

      <div className="ist-approval-filters">
        <button type="button" className={`ist-approval-filter${filter === 'pending' ? ' is-active' : ''}`} onClick={() => setFilter('pending')}>
          Čakajúce ({pendingCount})
        </button>
        <button type="button" className={`ist-approval-filter${filter === 'all' ? ' is-active' : ''}`} onClick={() => setFilter('all')}>
          Všetky ({requests.length})
        </button>
      </div>

      {error ? <div className="ist-approval-error">{error}</div> : null}

      <div className="ist-approval-list">
        {visible.length === 0 ? (
          <div className="ist-approval-empty">Žiadne žiadosti.</div>
        ) : visible.map((r) => (
          <div key={r.id} className={`ist-approval-item ist-approval-item--${r.status}`}>
            <div className="ist-approval-item-head">
              <span className={`ist-approval-status ist-approval-status--${r.status}`}>
                {r.status === 'pending' ? 'Čaká' : r.status === 'approved' ? 'Schválené' : 'Zamietnuté'}
              </span>
              <span className="ist-approval-item-store">{r.store?.name || r.storeId}</span>
              <span className="ist-approval-item-metric">{r.metricCode}</span>
              <span className="ist-approval-item-month">{r.monthLabel}</span>
              <span className="ist-approval-item-date">{dateFormatter.format(new Date(r.createdAt))}</span>
            </div>
            <div className="ist-approval-item-vals">
              <span>{formatNumber(r.oldValue)}</span>
              <span className="ist-approval-arrow">→</span>
              <strong>{formatNumber(r.newValue)}</strong>
            </div>
            <div className="ist-approval-item-reason">
              <span className="ist-approval-reason-label">VOD ({r.requestedByName}):</span> {r.reason}
            </div>
            {r.status === 'pending' && canDecide ? (
              <div className="ist-approval-item-actions">
                <input
                  type="text"
                  className="ist-approval-note"
                  placeholder="Krátka poznámka (nepovinné)"
                  value={decisionNotes[r.id] || ''}
                  onChange={(e) => setDecisionNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  disabled={busyId === r.id}
                />
                <button
                  type="button"
                  className="ist-approval-button ist-approval-button--approve"
                  onClick={() => handleDecide(r.id, 'approve')}
                  disabled={busyId === r.id}
                >
                  Schváliť
                </button>
                <button
                  type="button"
                  className="ist-approval-button ist-approval-button--reject"
                  onClick={() => handleDecide(r.id, 'reject')}
                  disabled={busyId === r.id}
                >
                  Zamietnuť
                </button>
              </div>
            ) : r.decisionNote ? (
              <div className="ist-approval-item-decision">
                {r.decidedByName ? `${r.decidedByName}: ` : ''}{r.decisionNote}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
