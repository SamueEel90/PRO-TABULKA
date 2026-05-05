'use client';

import { useCallback, useEffect, useState } from 'react';

type TaskCounts = {
  open: number;
  done: number;
  total: number;
};

type TaskItem = {
  id: string;
  scopeKey: string;
  metricKey: string | null;
  monthLabel: string | null;
  text: string;
  status: string;
  createdByRole: string;
  createdByName: string;
  createdAt: string;
  completedByName: string | null;
  completedAt: string | null;
};

type TaskCounterProps = {
  scopeKey: string;
  broadcastScopeKey?: string;
  currentRole: string;
  currentAuthor: string;
};

const dateFormatter = new Intl.DateTimeFormat('sk-SK', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(value: string | null) {
  if (!value) return '';
  try {
    return dateFormatter.format(new Date(value));
  } catch {
    return value;
  }
}

export function TaskCounter({ scopeKey, broadcastScopeKey, currentRole, currentAuthor }: TaskCounterProps) {
  const [counts, setCounts] = useState<TaskCounts>({ open: 0, done: 0, total: 0 });
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open');
  const canCompleteTasks = currentRole === 'VOD';

  const fetchTasks = useCallback(async () => {
    if (!scopeKey) return;
    try {
      const params = new URLSearchParams({ scopeKey });
      if (broadcastScopeKey) params.set('broadcastScopeKey', broadcastScopeKey);
      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setTasks(data.tasks || []);
        setCounts(data.counts || { open: 0, done: 0, total: 0 });
      }
    } catch {
      /* ignore */
    }
  }, [scopeKey, broadcastScopeKey]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const handler = () => fetchTasks();
    window.addEventListener('pro-dashboard:tasks-changed', handler);
    return () => window.removeEventListener('pro-dashboard:tasks-changed', handler);
  }, [fetchTasks]);

  const handleStatusChange = async (taskId: string, newStatus: 'open' | 'done') => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, completedByName: currentAuthor }),
      });
      await fetchTasks();
      window.dispatchEvent(new CustomEvent('pro-dashboard:tasks-changed'));
      window.dispatchEvent(new CustomEvent('pro-dashboard:activity-changed'));
    } catch {
      /* ignore */
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  // Hide completely if no tasks
  if (counts.total === 0 && !open) {
    return null;
  }

  if (!open) {
    return (
      <button
        type="button"
        className="task-counter-toggle"
        onClick={() => setOpen(true)}
        title="Zobraziť úlohy"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        <span className="task-counter-label">Úlohy</span>
        {counts.open > 0 ? (
          <span className="task-counter-pill task-counter-pill--open">
            {counts.open} otvorené
          </span>
        ) : null}
        {counts.done > 0 ? (
          <span className="task-counter-pill task-counter-pill--done">
            {counts.done} splnené
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div className="task-panel">
      <div className="task-panel-header">
        <h4 className="task-panel-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          Úlohy ({counts.open} otvorené / {counts.done} splnené)
        </h4>
        <button type="button" className="task-panel-close" onClick={() => setOpen(false)} aria-label="Zavrieť">
          &times;
        </button>
      </div>

      <div className="task-panel-filters">
        <button
          type="button"
          className={`task-panel-filter${filter === 'open' ? ' is-active' : ''}`}
          onClick={() => setFilter('open')}
        >
          Otvorené ({counts.open})
        </button>
        <button
          type="button"
          className={`task-panel-filter${filter === 'done' ? ' is-active' : ''}`}
          onClick={() => setFilter('done')}
        >
          Splnené ({counts.done})
        </button>
        <button
          type="button"
          className={`task-panel-filter${filter === 'all' ? ' is-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Všetky ({counts.total})
        </button>
      </div>

      <div className="task-panel-list">
        {filteredTasks.length === 0 ? (
          <div className="task-panel-empty">
            {filter === 'open' ? 'Žiadne otvorené úlohy.' : filter === 'done' ? 'Žiadne splnené úlohy.' : 'Žiadne úlohy.'}
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div key={task.id} className={`task-item task-item--${task.status}`}>
              <div className="task-item-main">
                <div className="task-item-text">{task.text}</div>
                <div className="task-item-meta">
                  <span className="task-item-author">
                    {task.createdByRole} · {task.createdByName}
                  </span>
                  {task.metricKey ? <span className="task-item-metric">{task.metricKey}</span> : null}
                  <span className="task-item-date">{formatDate(task.createdAt)}</span>
                </div>
                {task.status === 'done' && task.completedByName ? (
                  <div className="task-item-completed">
                    Splnené: {task.completedByName} · {formatDate(task.completedAt)}
                  </div>
                ) : null}
              </div>
              {canCompleteTasks ? (
                <div className="task-item-actions">
                  {task.status === 'open' ? (
                    <button
                      type="button"
                      className="task-item-button task-item-button--done"
                      onClick={() => handleStatusChange(task.id, 'done')}
                      title="Označiť ako splnené"
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="task-item-button task-item-button--reopen"
                      onClick={() => handleStatusChange(task.id, 'open')}
                      title="Vrátiť späť"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                      </svg>
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
