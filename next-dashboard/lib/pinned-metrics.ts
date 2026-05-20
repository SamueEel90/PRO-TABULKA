const STORAGE_PREFIX = 'proDashboard.pinnedMetrics';
const CHANGE_EVENT = 'pro-dashboard:pinned-metrics-changed';

function buildKey(scopeId: string, role: string) {
  return `${STORAGE_PREFIX}.${String(scopeId || 'unknown')}.${String(role || 'unknown').toUpperCase()}`;
}

export function loadPinnedMetrics(scopeId: string, role: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(buildKey(scopeId, role));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value: unknown) => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

export function savePinnedMetrics(scopeId: string, role: string, pinned: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(buildKey(scopeId, role), JSON.stringify(Array.from(pinned)));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { scopeId, role } }));
  } catch {
    /* noop */
  }
}

export function togglePinnedMetric(scopeId: string, role: string, metric: string): Set<string> {
  const current = loadPinnedMetrics(scopeId, role);
  if (current.has(metric)) current.delete(metric);
  else current.add(metric);
  savePinnedMetrics(scopeId, role, current);
  return current;
}

export function subscribePinnedMetrics(scopeId: string, role: string, callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
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

function normalizeMetricName(value: string): string {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function isNegativeOnlyMetric(metric: string): boolean {
  return normalizeMetricName(metric) === normalizeMetricName('Saldo DF (-)');
}

export function clampMetricValue(metric: string, value: number | string): number {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return 0;
  if (isNegativeOnlyMetric(metric)) return -Math.abs(num);
  return num;
}
