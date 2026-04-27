export function normalizeMetricName(value: string) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function hasActualRealValue(row: { hasRealFlags?: boolean[]; values?: number[] } | null | undefined, index: number) {
  if (!row) {
    return false;
  }

  if (Array.isArray(row.hasRealFlags)) {
    return Boolean(row.hasRealFlags[index]);
  }

  return Math.abs(Number((row.values && row.values[index]) || 0)) > 0.0001;
}

export function getActualRealValue(row: { actualValues?: number[]; values?: number[] } | null | undefined, index: number) {
  if (!row) {
    return 0;
  }

  if (Array.isArray(row.actualValues)) {
    return Number(row.actualValues[index] || 0);
  }

  return Number((row.values && row.values[index]) || 0);
}

const monthMap: Record<string, number> = {
  januar: 0,
  februar: 1,
  marec: 2,
  april: 3,
  maj: 4,
  jun: 5,
  jul: 6,
  august: 7,
  september: 8,
  oktober: 9,
  november: 10,
  december: 11,
};

export function parseChartMonthLabel(label: string) {
  const parts = String(label || '').trim().split(/\s+/);
  if (parts.length < 2) {
    return null;
  }

  const monthName = normalizeMetricName(parts[0]);
  const yearValue = Number(parts[1]);
  if (!Object.prototype.hasOwnProperty.call(monthMap, monthName) || !yearValue) {
    return null;
  }

  return new Date(yearValue, monthMap[monthName], 1);
}

export function isChartMonthClosed(label: string) {
  const monthDate = parseChartMonthLabel(label);
  if (!monthDate) {
    return false;
  }

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return monthDate.getTime() < currentMonthStart.getTime();
}

export function getChartQuarterKey(label: string) {
  const monthDate = parseChartMonthLabel(label);
  if (!monthDate) {
    return '';
  }

  const month = monthDate.getMonth();
  if (month >= 2 && month <= 4) {
    return 'q1';
  }
  if (month >= 5 && month <= 7) {
    return 'q2';
  }
  if (month >= 8 && month <= 10) {
    return 'q3';
  }
  return 'q4';
}

export function getMonthIndexesByFilter(labels: string[], filterMode?: string) {
  const monthLabels = Array.isArray(labels) ? labels : [];
  const activeFilter = filterMode || 'all';
  const indexes = monthLabels.reduce<number[]>((result, label, index) => {
    const isClosed = isChartMonthClosed(label);
    const quarterKey = getChartQuarterKey(label);
    if (/^month-\d+$/.test(activeFilter) && index !== Number(activeFilter.split('-')[1])) {
      return result;
    }
    if (activeFilter === 'closed' && !isClosed) {
      return result;
    }
    if (activeFilter === 'open' && isClosed) {
      return result;
    }
    if (/^q[1-4]$/.test(activeFilter) && quarterKey !== activeFilter) {
      return result;
    }
    result.push(index);
    return result;
  }, []);

  return indexes.length ? indexes : monthLabels.map((_, index) => index);
}

export function pickValuesByIndexes<T>(values: T[], indexes: number[]) {
  return (indexes || []).map((index) => values[index]);
}

export function pickDataSeriesByIndexes(dataSeries: Record<string, number[] | boolean[]>, indexes: number[]) {
  const filtered: Record<string, number[] | boolean[]> = {};
  Object.keys(dataSeries || {}).forEach((key) => {
    const series = dataSeries[key] || [];
    filtered[key] = (indexes || []).map((index) => series[index]) as number[] | boolean[];
  });
  return filtered;
}

export function filterChartSeriesByMonth(labels: string[], dataSeries: Record<string, number[] | boolean[]>, filterMode?: string) {
  const visibleIndexes = getMonthIndexesByFilter(labels || [], filterMode);
  const filtered = pickDataSeriesByIndexes(dataSeries, visibleIndexes) as Record<string, number[] | boolean[]> & { labels: string[] };
  filtered.labels = pickValuesByIndexes(labels || [], visibleIndexes);
  return filtered;
}

export const CHART_MONTH_FILTERS = {
  all: { label: 'Všetky', suffix: 'Zobrazené sú všetky mesiace obchodného roka.' },
  q1: { label: 'Q1', suffix: 'Zobrazený je 1. kvartál obchodného roka: marec až máj.' },
  q2: { label: 'Q2', suffix: 'Zobrazený je 2. kvartál obchodného roka: jún až august.' },
  q3: { label: 'Q3', suffix: 'Zobrazený je 3. kvartál obchodného roka: september až november.' },
  q4: { label: 'Q4', suffix: 'Zobrazený je 4. kvartál obchodného roka: december až február.' },
  open: { label: 'Otvorené', suffix: 'Zobrazené sú len otvorené mesiace.' },
  closed: { label: 'Uzavreté', suffix: 'Zobrazené sú len uzavreté mesiace.' },
 } as const;

export const NET_HOURS_COMPONENTS: Array<[string, number, number]> = [
  ['Dlhodobá neprítomnosť (33+ dní) (b)', -1, 1],
  ['Dovolenka (-)', -1, 1],
  ['PN Krátkodobé', -1, 1],
  ['Odmena za dohodu', 1, 1],
  ['Externá pracovná agentúra (+) Reinigung', 1, 1],
  ['Externá pracovná agentúra (+) Wareneinräumung', 1, 1],
  ['Odmena za pr.prácu žiak (+) 50%', 1, 0.5],
  ['Nadčasy (+)', 1, 1],
  ['Saldo DF (+)', 1, 1],
  ['Saldo DF (-)', 1, 1],
  ['Plat sviatky', -1, 1],
];

export function computeNetHoursDelta(structureDelta: number, getComponentDelta: (metricName: string) => number) {
  let total = structureDelta;
  for (let index = 0; index < NET_HOURS_COMPONENTS.length; index += 1) {
    const component = NET_HOURS_COMPONENTS[index];
    total += component[1] * component[2] * getComponentDelta(component[0]);
  }
  return total;
}

export function escapeHtml(value: unknown) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
