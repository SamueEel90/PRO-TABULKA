export type MetricLayout = {
  order: string[];
  hidden: string[];
};

const STORAGE_PREFIX = 'proDashboard.metricLayout';
const CHANGE_EVENT = 'pro-dashboard:metric-layout-changed';

function buildKey(scopeId: string, role: string) {
  return `${STORAGE_PREFIX}.${String(scopeId || 'unknown')}.${String(role || 'unknown').toUpperCase()}`;
}

function emptyLayout(): MetricLayout {
  return { order: [], hidden: [] };
}

export function loadLayout(scopeId: string, role: string): MetricLayout {
  if (typeof window === 'undefined') {
    return emptyLayout();
  }
  try {
    const raw = window.localStorage.getItem(buildKey(scopeId, role));
    if (!raw) {
      return emptyLayout();
    }
    const parsed = JSON.parse(raw);
    return {
      order: Array.isArray(parsed?.order) ? parsed.order.filter((value: unknown) => typeof value === 'string') : [],
      hidden: Array.isArray(parsed?.hidden) ? parsed.hidden.filter((value: unknown) => typeof value === 'string') : [],
    };
  } catch {
    return emptyLayout();
  }
}

export function saveLayout(scopeId: string, role: string, layout: MetricLayout): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(buildKey(scopeId, role), JSON.stringify(layout));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { scopeId, role } }));
  } catch {
    /* noop */
  }
}

export function resetLayout(scopeId: string, role: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(buildKey(scopeId, role));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { scopeId, role } }));
  } catch {
    /* noop */
  }
}

export function applyLayout<T extends { metric: string }>(sections: T[], layout: MetricLayout): T[] {
  const hiddenSet = new Set(layout.hidden || []);
  const visible = sections.filter((section) => !hiddenSet.has(section.metric));
  if (!layout.order || layout.order.length === 0) {
    return visible;
  }
  const indexByMetric = new Map<string, number>();
  layout.order.forEach((metric, index) => {
    indexByMetric.set(metric, index);
  });
  const ordered = visible.slice().sort((a, b) => {
    const indexA = indexByMetric.has(a.metric) ? (indexByMetric.get(a.metric) as number) : Number.POSITIVE_INFINITY;
    const indexB = indexByMetric.has(b.metric) ? (indexByMetric.get(b.metric) as number) : Number.POSITIVE_INFINITY;
    if (indexA === indexB) {
      return 0;
    }
    return indexA - indexB;
  });
  return ordered;
}

export function subscribeLayout(scopeId: string, role: string, callback: () => void): () => void {
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
