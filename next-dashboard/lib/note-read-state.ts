const STORAGE_PREFIX = 'proDashboard.noteRead';
const CHANGE_EVENT = 'pro-dashboard:note-read-changed';

function buildKey(scopeKey: string, metricKey: string) {
  return `${STORAGE_PREFIX}.${String(scopeKey || '')}|${String(metricKey || '')}`;
}

export function getLastReadAt(scopeKey: string, metricKey: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(buildKey(scopeKey, metricKey));
  } catch {
    return null;
  }
}

export function markRead(scopeKey: string, metricKey: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(buildKey(scopeKey, metricKey), new Date().toISOString());
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { scopeKey, metricKey } }));
  } catch {
    /* noop */
  }
}

export function countUnread(
  comments: Array<{ createdAt: string; author: string }>,
  lastReadAt: string | null,
  currentAuthor: string,
): number {
  if (!comments || !comments.length) {
    return 0;
  }
  const lastReadTime = lastReadAt ? Date.parse(lastReadAt) : 0;
  return comments.reduce((count, comment) => {
    if (comment.author === currentAuthor) {
      return count;
    }
    const createdAt = Date.parse(comment.createdAt);
    if (Number.isNaN(createdAt)) {
      return count;
    }
    if (!lastReadTime || createdAt > lastReadTime) {
      return count + 1;
    }
    return count;
  }, 0);
}

export function subscribeReadState(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = () => callback();
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
