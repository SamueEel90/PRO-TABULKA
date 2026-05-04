'use client';

import { useCallback, useEffect, useState } from 'react';

type ActivityEntry = {
  id: string;
  scopeKey: string;
  actorRole: string;
  actorName: string;
  action: string;
  metricKey?: string | null;
  monthLabel?: string | null;
  detail?: string | null;
  createdAt: string;
};

type ActivityFeedProps = {
  scopeKey: string;
  userId: string;
};

const dateFormatter = new Intl.DateTimeFormat('sk-SK', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(iso: string) {
  try {
    return dateFormatter.format(new Date(iso));
  } catch {
    return iso;
  }
}

function actionIcon(action: string) {
  switch (action) {
    case 'comment':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'adjustment':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
        </svg>
      );
    case 'save':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
        </svg>
      );
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
}

function actionLabel(action: string) {
  switch (action) {
    case 'comment': return 'komentoval/a';
    case 'adjustment': return 'upravil/a hodnotu';
    case 'save': return 'uložil/a zmeny';
    case 'task-created': return 'vytvoril/a úlohu';
    case 'task-completed': return 'splnil/a úlohu';
    case 'task-reopened': return 'znova otvoril/a úlohu';
    case 'task-dismissed': return 'zrušil/a úlohu';
    default: return action;
  }
}

export function ActivityFeed({ scopeKey, userId }: ActivityFeedProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [lastSeenAt, setLastSeenAt] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const fetchActivity = useCallback(async () => {
    if (!scopeKey || !userId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/activity?scopeKey=${encodeURIComponent(scopeKey)}&userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.ok) {
        setEntries(data.entries || []);
        setNewCount(data.newCount || 0);
        setLastSeenAt(data.lastSeenAt || '');
      } else {
        setError(data.error || 'Chyba.');
      }
    } catch {
      setError('Nepodarilo sa načítať aktivitu.');
    } finally {
      setLoading(false);
    }
  }, [scopeKey, userId]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Listen for new activity events (after comments, saves, task changes)
  useEffect(() => {
    const handler = () => {
      fetchActivity();
    };
    window.addEventListener('pro-dashboard:activity-changed', handler);
    return () => window.removeEventListener('pro-dashboard:activity-changed', handler);
  }, [fetchActivity]);

  // Also poll every 30s for new activity (catches legacy save flows that don't dispatch events)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchActivity();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  const lastSeenDate = lastSeenAt ? new Date(lastSeenAt) : null;

  if (!open) {
    return (
      <button
        type="button"
        className="activity-feed-toggle"
        onClick={() => setOpen(true)}
        title="Zobraziť čo sa zmenilo"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <span>Aktivita</span>
        {newCount > 0 ? <span className="activity-feed-badge">{newCount}</span> : null}
      </button>
    );
  }

  return (
    <div className="activity-feed-panel">
      <div className="activity-feed-header">
        <h4 className="activity-feed-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Čo sa zmenilo
          {newCount > 0 ? <span className="activity-feed-header-count">({newCount} nových)</span> : null}
        </h4>
        <button type="button" className="activity-feed-close" onClick={() => setOpen(false)} aria-label="Zavrieť">
          &times;
        </button>
      </div>

      <div className="activity-feed-list">
        {loading && entries.length === 0 ? (
          <div className="activity-feed-empty">Načítavam...</div>
        ) : error ? (
          <div className="activity-feed-error">{error}</div>
        ) : entries.length === 0 ? (
          <div className="activity-feed-empty">Žiadna aktivita za posledných 14 dní.</div>
        ) : (
          entries.map((entry) => {
            const entryDate = new Date(entry.createdAt);
            const isNew = lastSeenDate ? entryDate > lastSeenDate : false;
            return (
              <div key={entry.id} className={`activity-entry${isNew ? ' activity-entry--new' : ''}`}>
                <div className="activity-entry-icon">{actionIcon(entry.action)}</div>
                <div className="activity-entry-content">
                  <div className="activity-entry-headline">
                    <strong>{entry.actorName}</strong>
                    <span className="activity-entry-role">({entry.actorRole})</span>
                    {' '}{actionLabel(entry.action)}
                    {entry.metricKey ? <span className="activity-entry-metric"> — {entry.metricKey}</span> : null}
                    {entry.monthLabel ? <span className="activity-entry-month"> ({entry.monthLabel})</span> : null}
                    {isNew ? <span className="activity-entry-new-tag">NOVÉ</span> : null}
                  </div>
                  {entry.detail ? <div className="activity-entry-detail">{entry.detail}</div> : null}
                  <div className="activity-entry-date">{formatDate(entry.createdAt)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
