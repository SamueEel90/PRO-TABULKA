const STORAGE_PREFIX = 'proDashboard.forecastDisplayMode';
const CHANGE_EVENT = 'pro-dashboard:forecast-display-mode-changed';

function buildKey(scopeId: string, role: string) {
  return `${STORAGE_PREFIX}.${String(scopeId || 'unknown')}.${String(role || 'unknown').toUpperCase()}`;
}

export function loadShowSavedMetrics(scopeId: string, role: string): Set<string> {
  if (typeof window === 'undefined') {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(buildKey(scopeId, role));
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((value: unknown) => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

export function toggleShowSavedMetric(scopeId: string, role: string, metric: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  const current = loadShowSavedMetrics(scopeId, role);
  if (current.has(metric)) {
    current.delete(metric);
  } else {
    current.add(metric);
  }
  try {
    window.localStorage.setItem(buildKey(scopeId, role), JSON.stringify(Array.from(current)));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { scopeId, role } }));
  } catch {
    /* noop */
  }
}

export function subscribeShowSavedMetrics(scopeId: string, role: string, callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{ scopeId: string; role: string }>;
    const detail = customEvent.detail;
    if (!detail || (detail.scopeId === scopeId && String(detail.role || '').toUpperCase() === String(role || '').toUpperCase())) {
      callback();
    }
  };
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
