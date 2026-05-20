'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { countUnread, getLastReadAt, markRead } from '@/lib/note-read-state';

type TaskInfo = {
  id: string;
  status: 'open' | 'done' | 'dismissed' | string;
  completedByName?: string | null;
  completedAt?: string | null;
};

type NoteComment = {
  id: string;
  scopeKey: string;
  metricKey: string;
  role: string;
  author: string;
  text: string;
  createdAt: string;
  isBroadcast?: boolean;
  task?: TaskInfo | null;
};

type NoteThreadProps = {
  /** Primary scope key, e.g. STORE|1020 or AGGREGATE|VKL|VKL Bratislava */
  scopeKey: string;
  /** When viewing a STORE, the parent VKL broadcast scope key (e.g. AGGREGATE|VKL|VKL Bratislava).
   *  Comments written at VKL level are visible to all stores under that VKL. */
  broadcastScopeKey?: string;
  metricKey: string;
  metricTitle: string;
  currentRole: string;
  currentAuthor: string;
  /** Current user's GF name — needed for GF composer to broadcast to all VKLs */
  gfName?: string;
  /** List of VKL names under the current GF — for GF composer "specific VKL" dropdown */
  gfVklOptions?: string[];
  /** Legacy single-note to show as first entry when no thread comments exist yet */
  legacyNote?: { text: string; author?: string; updatedAt?: string } | null;
};

type GfTarget =
  | { kind: 'all' }
  | { kind: 'vkl'; vkl: string };

const dateFormatter = new Intl.DateTimeFormat('sk-SK', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function formatCommentDate(iso: string) {
  try {
    return dateFormatter.format(new Date(iso));
  } catch {
    return iso;
  }
}

function roleLabel(role: string) {
  if (role === 'VOD') return 'VOD';
  if (role === 'VKL') return 'VKL';
  if (role === 'GF') return 'GF';
  return role;
}

function roleBadgeClass(role: string) {
  if (role === 'VOD') return 'note-role-badge note-role-badge--vod';
  if (role === 'VKL') return 'note-role-badge note-role-badge--vkl';
  return 'note-role-badge';
}

export function NoteThread({ scopeKey, broadcastScopeKey, metricKey, metricTitle, currentRole, currentAuthor, gfName = '', gfVklOptions = [], legacyNote }: NoteThreadProps) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<NoteComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [createTask, setCreateTask] = useState(false);
  const [error, setError] = useState('');
  // Track which task is currently being mutated (status flip / delete) so we
  // can show an inline spinner on its specific button. The Sheets save can
  // take 3-8s — without this the user clicks "Splnené" and sees no feedback,
  // then clicks again thinking the first click didn't register.
  const [pendingTaskAction, setPendingTaskAction] = useState<string | null>(null);
  const isGf = currentRole === 'GF';
  const canBroadcastAsGf = isGf && Boolean(gfName);
  const [gfTarget, setGfTarget] = useState<GfTarget>({ kind: 'all' });
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const personalScopeKey = isGf && gfName ? `PRIVATE|GF|${gfName}` : '';
  const [personalComments, setPersonalComments] = useState<NoteComment[]>([]);
  const [personalText, setPersonalText] = useState('');
  const [personalSending, setPersonalSending] = useState(false);

  const threadCount = comments.length + (legacyNote && !comments.length ? 1 : 0);
  const openTaskCount = comments.filter((c) => c.task && c.task.status === 'open').length;
  const [readMarker, setReadMarker] = useState<string | null>(() => getLastReadAt(scopeKey, metricKey));
  const unreadCount = useMemo(
    () => countUnread(comments, readMarker, currentAuthor),
    [comments, readMarker, currentAuthor],
  );
  const canCreateTasks = currentRole === 'VKL' || currentRole === 'GF';
  const canCompleteTasks = currentRole === 'VOD' || currentRole === 'VKL';
  const canDeleteTasks = currentRole === 'VKL' || currentRole === 'GF';
  const taskTargetLabel = isGf ? 'VKL' : 'VOD';
  const canDeleteComment = (comment: NoteComment) => {
    if (currentRole === 'VKL' || currentRole === 'GF') return true;
    if (currentRole === 'VOD') return comment.role === 'VOD' && comment.author === currentAuthor;
    return false;
  };

  const fetchComments = useCallback(async () => {
    if (!scopeKey || !metricKey) return;
    setLoading(true);
    setError('');
    try {
      // Build query — include broadcast scope if viewing a store
      const params = new URLSearchParams({ scopeKey, metricKey });
      if (broadcastScopeKey) {
        params.set('broadcastScopeKey', broadcastScopeKey);
      }
      const res = await fetch(`/api/notes?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setComments(data.comments || []);
      } else {
        setError(data.error || 'Chyba pri načítaní.');
      }
    } catch {
      setError('Nepodarilo sa načítať komentáre.');
    } finally {
      setLoading(false);
    }
  }, [scopeKey, broadcastScopeKey, metricKey]);

  const fetchPersonalComments = useCallback(async () => {
    if (!personalScopeKey || !metricKey) return;
    try {
      const res = await fetch(`/api/notes?scopeKey=${encodeURIComponent(personalScopeKey)}&metricKey=${encodeURIComponent(metricKey)}`);
      const data = await res.json();
      if (data.ok) {
        setPersonalComments(data.comments || []);
      }
    } catch {
      /* best effort */
    }
  }, [personalScopeKey, metricKey]);

  useEffect(() => {
    if (open) {
      fetchComments();
      if (personalScopeKey) fetchPersonalComments();
    }
  }, [open, fetchComments, fetchPersonalComments, personalScopeKey]);

  useEffect(() => {
    if (open && comments.length) {
      markRead(scopeKey, metricKey);
      setReadMarker(new Date().toISOString());
    }
  }, [open, comments.length, scopeKey, metricKey]);

  useEffect(() => {
    setReadMarker(getLastReadAt(scopeKey, metricKey));
  }, [scopeKey, metricKey]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, comments]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    let effectiveScopeKey = scopeKey;
    if (canBroadcastAsGf) {
      if (gfTarget.kind === 'vkl' && gfTarget.vkl) {
        effectiveScopeKey = `AGGREGATE|VKL|${gfTarget.vkl}`;
      } else {
        effectiveScopeKey = `AGGREGATE|GF|${gfName}`;
      }
    }

    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopeKey: effectiveScopeKey,
          metricKey,
          role: currentRole,
          author: currentAuthor,
          text: trimmed,
          createTask: createTask && canCreateTasks,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setText('');
        setCreateTask(false);
        await fetchComments();
        // Notify other components (activity feed, task counter)
        window.dispatchEvent(new CustomEvent('pro-dashboard:activity-changed'));
        window.dispatchEvent(new CustomEvent('pro-dashboard:tasks-changed'));
      } else {
        setError(data.error || 'Nepodarilo sa odoslať.');
      }
    } catch {
      setError('Nepodarilo sa odoslať komentár.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Zmazať tento komentár?')) return;
    try {
      await fetch(`/api/notes/${commentId}`, { method: 'DELETE' });
      await fetchComments();
      window.dispatchEvent(new CustomEvent('pro-dashboard:activity-changed'));
      window.dispatchEvent(new CustomEvent('pro-dashboard:tasks-changed'));
    } catch {
      setError('Nepodarilo sa zmazať komentár.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Zmazať túto úlohu?')) return;
    setPendingTaskAction(`delete:${taskId}`);
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      await fetchComments();
      window.dispatchEvent(new CustomEvent('pro-dashboard:activity-changed'));
      window.dispatchEvent(new CustomEvent('pro-dashboard:tasks-changed'));
    } catch {
      setError('Nepodarilo sa zmazať úlohu.');
    } finally {
      setPendingTaskAction(null);
    }
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: 'open' | 'done') => {
    setPendingTaskAction(`${newStatus}:${taskId}`);
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          completedByName: currentAuthor,
        }),
      });
      await fetchComments();
      window.dispatchEvent(new CustomEvent('pro-dashboard:activity-changed'));
      window.dispatchEvent(new CustomEvent('pro-dashboard:tasks-changed'));
    } catch {
      setError('Nepodarilo sa upraviť úlohu.');
    } finally {
      setPendingTaskAction(null);
    }
  };

  const handleSendPersonal = async () => {
    const trimmed = personalText.trim();
    if (!trimmed || personalSending || !personalScopeKey) return;
    setPersonalSending(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopeKey: personalScopeKey,
          metricKey,
          role: currentRole,
          author: currentAuthor,
          text: trimmed,
          createTask: false,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPersonalText('');
        await fetchPersonalComments();
      } else {
        setError(data.error || 'Nepodarilo sa uložiť poznámku.');
      }
    } catch {
      setError('Nepodarilo sa uložiť osobnú poznámku.');
    } finally {
      setPersonalSending(false);
    }
  };

  const handleDeletePersonal = async (id: string) => {
    if (!confirm('Zmazať túto osobnú poznámku?')) return;
    try {
      await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      await fetchPersonalComments();
    } catch {
      setError('Nepodarilo sa zmazať poznámku.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Pre-load comments to know task counts even before opening
  useEffect(() => {
    if (!open && scopeKey && metricKey) {
      fetchComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, metricKey, broadcastScopeKey]);

  // Re-fetch when tasks change elsewhere
  useEffect(() => {
    const handler = () => fetchComments();
    window.addEventListener('pro-dashboard:tasks-changed', handler);
    return () => window.removeEventListener('pro-dashboard:tasks-changed', handler);
  }, [fetchComments]);

  // Inline badge (shown in the metric header)
  if (!open) {
    return (
      <button
        type="button"
        className={`note-thread-toggle${openTaskCount > 0 ? ' note-thread-toggle--has-tasks' : ''}${unreadCount > 0 ? ' note-thread-toggle--has-unread' : ''}`}
        onClick={() => setOpen(true)}
        title={
          unreadCount > 0
            ? `${unreadCount} nových komentárov`
            : openTaskCount > 0
              ? `${openTaskCount} otvorených úloh`
              : legacyNote?.text || 'Otvoriť vlákno komentárov'
        }
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {unreadCount > 0 ? (
          <span className="note-thread-unread" title={`${unreadCount} nových`}>{unreadCount} nové</span>
        ) : threadCount > 0 ? (
          <span className="note-thread-count">{threadCount}</span>
        ) : null}
        {openTaskCount > 0 ? (
          <span className="note-thread-task-badge" title={`${openTaskCount} otvorených úloh`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            {openTaskCount}
          </span>
        ) : null}
        {legacyNote && !comments.length ? (
          <span className="note-thread-preview">{legacyNote.text}</span>
        ) : null}
      </button>
    );
  }

  // Full thread panel
  return (
    <div className="note-thread-panel">
      <div className="note-thread-header">
        <h4 className="note-thread-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Komentáre — {metricTitle}
        </h4>
        <button type="button" className="note-thread-close" onClick={() => setOpen(false)} aria-label="Zavrieť">
          &times;
        </button>
      </div>

      {personalScopeKey ? (
        <div className="note-thread-personal">
          <div className="note-thread-personal-head">
            <span className="note-thread-personal-title">Moje poznámky</span>
            <span className="note-thread-personal-hint">vidíš iba ty</span>
          </div>
          {personalComments.length ? (
            <ul className="note-thread-personal-list">
              {personalComments.map((entry) => (
                <li key={entry.id} className="note-thread-personal-item">
                  <span className="note-thread-personal-date">{formatCommentDate(entry.createdAt)}</span>
                  <span className="note-thread-personal-text">{entry.text}</span>
                  <button
                    type="button"
                    className="note-thread-personal-delete"
                    onClick={() => handleDeletePersonal(entry.id)}
                    aria-label="Zmazať poznámku"
                    title="Zmazať"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="note-thread-personal-input">
            <textarea
              className="note-thread-personal-textarea"
              rows={2}
              placeholder="Tvoja súkromná poznámka…"
              value={personalText}
              onChange={(e) => setPersonalText(e.target.value)}
              disabled={personalSending}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendPersonal();
                }
              }}
            />
            <button
              type="button"
              className="note-thread-personal-save"
              onClick={handleSendPersonal}
              disabled={personalSending || !personalText.trim()}
            >
              {personalSending ? (
                <>
                  <span className="inline-spinner inline-spinner--sm" aria-hidden="true" /> Ukladám…
                </>
              ) : 'Uložiť'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="note-thread-list" ref={listRef}>
        {/* Show legacy note as first entry if no thread comments exist */}
        {legacyNote && !comments.length ? (
          <div className="note-comment note-comment--legacy">
            <div className="note-comment-header">
              <span className={roleBadgeClass('VOD')}>{roleLabel('VOD')}</span>
              <span className="note-comment-author">{legacyNote.author || 'Neznámy'}</span>
              {legacyNote.updatedAt ? <span className="note-comment-date">{legacyNote.updatedAt}</span> : null}
            </div>
            <div className="note-comment-text">{legacyNote.text}</div>
          </div>
        ) : null}

        {loading && !comments.length ? (
          <div className="note-thread-empty">Načítavam...</div>
        ) : null}

        {!loading && !comments.length && !legacyNote ? (
          <div className="note-thread-empty">Zatiaľ žiadne komentáre.</div>
        ) : null}

        {comments.map((comment) => {
          const task = comment.task;
          const isTaskOpen = task?.status === 'open';
          const isTaskDone = task?.status === 'done';
          return (
            <div
              key={comment.id}
              className={
                'note-comment' +
                (comment.isBroadcast ? ' note-comment--broadcast' : '') +
                (isTaskOpen ? ' note-comment--task-open' : '') +
                (isTaskDone ? ' note-comment--task-done' : '')
              }
            >
              <div className="note-comment-header">
                <span className={roleBadgeClass(comment.role)}>{roleLabel(comment.role)}</span>
                <span className="note-comment-author">{comment.author}</span>
                {comment.isBroadcast ? (
                  <span className="note-comment-broadcast-tag">
                    {comment.scopeKey.startsWith('AGGREGATE|GF|')
                      ? 'globálne od GF'
                      : 'pre všetky filiálky'}
                  </span>
                ) : null}
                {task ? (
                  <span className={`note-task-badge note-task-badge--${task.status}`}>
                    {isTaskDone ? (
                      <>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Splnené
                      </>
                    ) : (
                      <>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="9" />
                        </svg>
                        Úloha
                      </>
                    )}
                  </span>
                ) : null}
                <span className="note-comment-date">{formatCommentDate(comment.createdAt)}</span>
                {canDeleteComment(comment) ? (
                  <button
                    type="button"
                    className="note-comment-delete"
                    onClick={() => handleDeleteComment(comment.id)}
                    aria-label="Zmazať komentár"
                    title="Zmazať komentár"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                ) : null}
              </div>
              <div className="note-comment-text">{comment.text}</div>
              {task && isTaskOpen && canCompleteTasks ? (
                <div className="note-task-actions">
                  <button
                    type="button"
                    className="note-task-button note-task-button--done"
                    onClick={() => handleTaskStatusChange(task.id, 'done')}
                    disabled={pendingTaskAction !== null}
                  >
                    {pendingTaskAction === `done:${task.id}` ? (
                      <>
                        <span className="inline-spinner inline-spinner--sm" aria-hidden="true" />
                        Ukladám…
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Označiť ako splnené
                      </>
                    )}
                  </button>
                  {canDeleteTasks ? (
                    <button
                      type="button"
                      className="note-task-button note-task-button--delete"
                      onClick={() => handleDeleteTask(task.id)}
                      disabled={pendingTaskAction !== null}
                    >
                      {pendingTaskAction === `delete:${task.id}` ? (
                        <>
                          <span className="inline-spinner inline-spinner--sm" aria-hidden="true" />
                          Mažem…
                        </>
                      ) : (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          </svg>
                          Zmazať úlohu
                        </>
                      )}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {task && isTaskDone ? (
                <div className="note-task-completed">
                  Splnené {task.completedByName ? `používateľom ${task.completedByName}` : ''}
                  {task.completedAt ? ` · ${formatCommentDate(task.completedAt as unknown as string)}` : ''}
                  {canCompleteTasks ? (
                    <button
                      type="button"
                      className="note-task-button note-task-button--reopen"
                      onClick={() => handleTaskStatusChange(task.id, 'open')}
                      disabled={pendingTaskAction !== null}
                    >
                      {pendingTaskAction === `open:${task.id}` ? (
                        <>
                          <span className="inline-spinner inline-spinner--sm" aria-hidden="true" />
                          Ukladám…
                        </>
                      ) : 'Vrátiť späť'}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? <div className="note-thread-error">{error}</div> : null}

      <div className="note-thread-input-wrap">
        {canBroadcastAsGf ? (
          <div className="note-thread-target">
            <span className="note-thread-target-label">Pre koho:</span>
            <label className="note-thread-target-option">
              <input
                type="radio"
                name={`gf-target-${metricKey}`}
                checked={gfTarget.kind === 'all'}
                onChange={() => setGfTarget({ kind: 'all' })}
              />
              <span>Všetkým VKL</span>
            </label>
            <label className="note-thread-target-option">
              <input
                type="radio"
                name={`gf-target-${metricKey}`}
                checked={gfTarget.kind === 'vkl'}
                onChange={() => setGfTarget({ kind: 'vkl', vkl: gfVklOptions[0] || '' })}
                disabled={!gfVklOptions.length}
              />
              <span>Konkrétnemu VKL</span>
            </label>
            {gfTarget.kind === 'vkl' ? (
              <select
                className="note-thread-target-select"
                value={gfTarget.vkl}
                onChange={(e) => setGfTarget({ kind: 'vkl', vkl: e.target.value })}
              >
                {gfVklOptions.map((vkl) => (
                  <option key={vkl} value={vkl}>{vkl}</option>
                ))}
              </select>
            ) : null}
          </div>
        ) : null}
        <div className="note-thread-input">
          <textarea
            ref={inputRef}
            className="note-thread-textarea"
            rows={2}
            placeholder={`Napíšte komentár ako ${roleLabel(currentRole)}...`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
          />
          <button
            type="button"
            className="note-thread-send"
            onClick={handleSend}
            disabled={sending || !text.trim()}
          >
            {sending ? (
              <>
                <span className="inline-spinner" aria-hidden="true" /> Odosielam…
              </>
            ) : 'Odoslať'}
          </button>
        </div>
        {canCreateTasks ? (
          <label className="note-thread-task-toggle">
            <input
              type="checkbox"
              checked={createTask}
              onChange={(e) => setCreateTask(e.target.checked)}
              disabled={sending}
            />
            <span>Pridať ako úlohu pre {taskTargetLabel}</span>
          </label>
        ) : null}
      </div>
    </div>
  );
}
