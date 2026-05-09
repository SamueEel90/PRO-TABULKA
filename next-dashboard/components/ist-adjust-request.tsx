'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type IstMonth = { id: string; label: string; value: number };

type AdjustmentRequest = {
  id: string;
  metricCode: string;
  monthId: string;
  monthLabel: string;
  oldValue: number;
  newValue: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  decidedByName?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  createdAt: string;
};

type Props = {
  storeId: string;
  metricCode: string;
  metricTitle: string;
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

export function IstAdjustRequest({ storeId, metricCode, metricTitle, currentRole }: Props) {
  const [open, setOpen] = useState(false);
  const [months, setMonths] = useState<IstMonth[]>([]);
  const [loadingMonths, setLoadingMonths] = useState(false);
  const [selectedMonthId, setSelectedMonthId] = useState('');
  const [newValueText, setNewValueText] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [myRequests, setMyRequests] = useState<AdjustmentRequest[]>([]);

  const isVod = currentRole === 'VOD';
  const selected = useMemo(() => months.find((m) => m.id === selectedMonthId) || null, [months, selectedMonthId]);
  const pendingForMetric = myRequests.filter((r) => r.metricCode === metricCode && r.status === 'pending').length;

  const fetchMonths = useCallback(async () => {
    if (!storeId || !metricCode) return;
    setLoadingMonths(true);
    try {
      const params = new URLSearchParams({ storeId, metricCode, listIstMonths: '1' });
      const res = await fetch(`/api/ist-adjustments?${params.toString()}`);
      const data = await res.json();
      if (data.ok) setMonths(data.months || []);
    } finally {
      setLoadingMonths(false);
    }
  }, [storeId, metricCode]);

  const fetchMyRequests = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await fetch(`/api/ist-adjustments?storeId=${encodeURIComponent(storeId)}`);
      const data = await res.json();
      if (data.ok) setMyRequests(data.requests || []);
    } catch { /* ignore */ }
  }, [storeId]);

  useEffect(() => {
    if (open) {
      fetchMonths();
      fetchMyRequests();
    }
  }, [open, fetchMonths, fetchMyRequests]);

  useEffect(() => {
    const handler = () => fetchMyRequests();
    window.addEventListener('pro-dashboard:ist-adjustments-changed', handler);
    return () => window.removeEventListener('pro-dashboard:ist-adjustments-changed', handler);
  }, [fetchMyRequests]);

  if (!isVod) return null;

  const handleSubmit = async () => {
    setError('');
    if (!selectedMonthId) { setError('Vyber mesiac.'); return; }
    const parsed = Number(String(newValueText).replace(',', '.'));
    if (Number.isNaN(parsed)) { setError('Zadaj platné číslo.'); return; }
    if (reason.trim().length < 3) { setError('Doplň odôvodnenie.'); return; }

    setSending(true);
    try {
      const res = await fetch('/api/ist-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metricCode, monthId: selectedMonthId, newValue: parsed, reason: reason.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setSelectedMonthId('');
        setNewValueText('');
        setReason('');
        await fetchMyRequests();
        window.dispatchEvent(new CustomEvent('pro-dashboard:ist-adjustments-changed'));
        window.dispatchEvent(new CustomEvent('pro-dashboard:activity-changed'));
      } else {
        setError(data.error || 'Nepodarilo sa odoslať.');
      }
    } catch {
      setError('Nepodarilo sa odoslať žiadosť.');
    } finally {
      setSending(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Zrušiť túto žiadosť?')) return;
    try {
      await fetch(`/api/ist-adjustments/${id}`, { method: 'DELETE' });
      await fetchMyRequests();
      window.dispatchEvent(new CustomEvent('pro-dashboard:ist-adjustments-changed'));
    } catch { /* ignore */ }
  };

  if (!open) {
    return (
      <button
        type="button"
        className={`ist-adjust-toggle${pendingForMetric > 0 ? ' ist-adjust-toggle--has-pending' : ''}`}
        onClick={() => setOpen(true)}
        title={pendingForMetric > 0 ? `${pendingForMetric} čakajúcich žiadostí o úpravu IST` : 'Žiadosť o úpravu IST hodnoty'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        {pendingForMetric > 0 ? <span className="ist-adjust-pending">{pendingForMetric}</span> : null}
      </button>
    );
  }

  const myForMetric = myRequests.filter((r) => r.metricCode === metricCode);

  return (
    <div className="ist-adjust-panel">
      <div className="ist-adjust-header">
        <h4 className="ist-adjust-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          Úprava IST — {metricTitle}
        </h4>
        <button type="button" className="ist-adjust-close" onClick={() => setOpen(false)} aria-label="Zavrieť">&times;</button>
      </div>

      <div className="ist-adjust-form">
        <label className="ist-adjust-field">
          <span className="ist-adjust-label">Mesiac</span>
          <select
            className="ist-adjust-select"
            value={selectedMonthId}
            onChange={(e) => setSelectedMonthId(e.target.value)}
            disabled={loadingMonths || sending}
          >
            <option value="">— vyber mesiac —</option>
            {months.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>

        {selected ? (
          <div className="ist-adjust-current">
            Aktuálna IST hodnota: <strong>{formatNumber(selected.value)}</strong>
          </div>
        ) : null}

        <label className="ist-adjust-field">
          <span className="ist-adjust-label">Nová hodnota</span>
          <input
            type="text"
            inputMode="decimal"
            className="ist-adjust-input"
            value={newValueText}
            onChange={(e) => setNewValueText(e.target.value)}
            placeholder="napr. 12345,67"
            disabled={sending}
          />
        </label>

        <label className="ist-adjust-field">
          <span className="ist-adjust-label">Odôvodnenie</span>
          <textarea
            rows={3}
            className="ist-adjust-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Prečo má byť hodnota iná…"
            disabled={sending}
          />
        </label>

        {error ? <div className="ist-adjust-error">{error}</div> : null}

        <button
          type="button"
          className="ist-adjust-submit"
          onClick={handleSubmit}
          disabled={sending}
        >
          {sending ? 'Odosielam…' : 'Odoslať na schválenie VKL'}
        </button>
      </div>

      {myForMetric.length ? (
        <div className="ist-adjust-history">
          <div className="ist-adjust-history-title">Moje žiadosti</div>
          {myForMetric.map((r) => (
            <div key={r.id} className={`ist-adjust-item ist-adjust-item--${r.status}`}>
              <div className="ist-adjust-item-line">
                <span className={`ist-adjust-status ist-adjust-status--${r.status}`}>
                  {r.status === 'pending' ? 'Čaká' : r.status === 'approved' ? 'Schválené' : 'Zamietnuté'}
                </span>
                <span className="ist-adjust-item-month">{r.monthLabel}</span>
                <span className="ist-adjust-item-vals">
                  {formatNumber(r.oldValue)} → <strong>{formatNumber(r.newValue)}</strong>
                </span>
                <span className="ist-adjust-item-date">{dateFormatter.format(new Date(r.createdAt))}</span>
                {r.status === 'pending' ? (
                  <button type="button" className="ist-adjust-item-cancel" onClick={() => handleCancel(r.id)} title="Zrušiť žiadosť">×</button>
                ) : null}
              </div>
              <div className="ist-adjust-item-reason">{r.reason}</div>
              {r.decisionNote ? <div className="ist-adjust-item-decision">VKL: {r.decisionNote}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
