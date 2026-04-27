import { prisma } from '@/lib/prisma';
import { resolveMonthLabel } from '@/lib/months';
import { computeNetHoursDelta } from '@/lib/legacy/shared';
import type {
  DashboardPayload,
  DashboardScope,
  DashboardScopeOption,
  DashboardUser,
  MetricFormat,
  MetricRow,
  MetricSection,
  WeeklyOverridesPayload,
} from '@/lib/legacy/contracts';

const GLOBAL_SCOPE_NOTE_METRIC = '__GLOBAL_SCOPE_NOTES__';
const BUSINESS_YEAR_START_MONTH_INDEX = 2;
const WORKFORCE_STRUCTURE_METRIC = 'Štruktúra filiálky (plné úväzky)';
const STRUCTURE_HOURS_METRIC = 'Štruktúra hodín';
const NET_HOURS_PLAN_VT_METRIC = 'Hodiny netto Plan VT';
const NET_HOURS_PLAN_DELTA_METRIC = 'Hodiny netto vs Netto Plan VT Δ h';
const WORKING_DAYS_METRIC = 'Pracovné dni zamestnancov';
const CLOSED_HOLIDAY_METRIC = 'Sviatok zatvorené';
const INVENTORY_METRIC = 'Inventúra (+)';
const FULL_TIME_DAILY_HOURS = 7.75;
const DASHBOARD_MONTH_LABELS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'máj', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DASHBOARD_MONTH_ALIASES: Record<string, number> = {
  jan: 0,
  january: 0,
  februar: 1,
  feb: 1,
  february: 1,
  marec: 2,
  mar: 2,
  march: 2,
  april: 3,
  'apríl': 3,
  apr: 3,
  'máj': 4,
  maj: 4,
  may: 4,
  jun: 5,
  'jún': 5,
  june: 5,
  jul: 6,
  'júl': 6,
  july: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  oktober: 9,
  'október': 9,
  oct: 9,
  october: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

const UI_METRIC_ORDER = [
  WORKFORCE_STRUCTURE_METRIC,
  'Dlhodobá neprítomnosť (33+ dní) (b)',
  'Hodiny Brutto GJ2026',
  'Pracovné dni zamestnancov',
  'Sviatok zatvorené',
  STRUCTURE_HOURS_METRIC,
  'Odmena za dohodu',
  'Externá pracovná agentúra (+) Reinigung',
  'Externá pracovná agentúra (+) Wareneinräumung',
  'PN Krátkodobé',
  'Odmena za pr.prácu žiak (+) 50%',
  'Nadčasy (+)',
  'Saldo DF (+)',
  'Saldo DF (-)',
  'Dovolenka (-)',
  'FiMa/Prestavba/Dodatočné práce/NEO',
  'Hodiny netto',
  'Obrat GJ2026',
  'Čistý výkon',
];

const WORKFORCE_STRUCTURE_BANDS = [
  { key: 'Štruktúra filiálky 100%', label: '100%', fteWeight: 1, hoursWeight: 7.75 },
  { key: 'Štruktúra filiálky 90%', label: '90%', fteWeight: 0.9, hoursWeight: 7 },
  { key: 'Štruktúra filiálky 77%', label: '77%', fteWeight: 0.77, hoursWeight: 6 },
  { key: 'Štruktúra filiálky 65%', label: '65%', fteWeight: 0.65, hoursWeight: 5 },
  { key: 'Štruktúra filiálky 52%', label: '52%', fteWeight: 0.52, hoursWeight: 4 },
  { key: 'Štruktúra filiálky 39%', label: '39%', fteWeight: 0.39, hoursWeight: 3 },
];

const EXCLUDED_METRICS = new Set([
  INVENTORY_METRIC,
  NET_HOURS_PLAN_VT_METRIC,
  NET_HOURS_PLAN_DELTA_METRIC,
  ...WORKFORCE_STRUCTURE_BANDS.map((band) => band.key),
]);

const PLAN_AS_PENDING_DELTA_METRICS = new Set([
  'Dlhodobá neprítomnosť (33+ dní) (b)',
  'Externá pracovná agentúra (+) Reinigung',
  'Externá pracovná agentúra (+) Wareneinräumung',
  'PN Krátkodobé',
  'Odmena za pr.prácu žiak (+) 50%',
  'Nadčasy (+)',
  'Saldo DF (+)',
  'Saldo DF (-)',
  'Dovolenka (-)',
  'FiMa/Prestavba/Dodatočné práce/NEO',
  'Hodiny netto',
  'Obrat GJ2026',
  'Čistý výkon',
]);

const PRIMARY_METRICS = [
  'Čistý výkon',
  'Obrat GJ2026',
  'Hodiny netto',
  'Dovolenka (-)',
  'Štruktúra hodín',
];

const HIDDEN_TABLE_METRICS = new Set(['Pracovné dni zamestnancov', 'Sviatok zatvorené']);

const SHORT_TERM_PN_SOURCES = new Set([
  'pn (< 10 dni) (-)',
  'ine (napr. uvol z prace, ocr, odber krvi,(-)',
]);

const NET_HOURS_SOURCE_ALIASES = new Set(['hodiny netto']);

const TURNOVER_METRIC = 'Obrat GJ2026';
const NET_HOURS_METRIC = 'Hodiny netto';
const CLEAN_PERFORMANCE_METRIC = 'Čistý výkon';

type AuthenticatedUser = DashboardUser & {
  accessibleStoreIds: string[];
};

type StructureData = {
  gfs: string[];
  vkls: string[];
  storeToHierarchy: Record<string, { gf: string; vkl: string }>;
  gfToStores: Record<string, string[]>;
  vklToStores: Record<string, string[]>;
  vklToGf: Record<string, string>;
};

type SourceName = 'PLAN' | 'IST' | 'VOD';

type AggregatedMonthValue = {
  value: number;
  present: boolean;
};

type AggregatedSourceData = Record<SourceName, Record<string, Record<string, AggregatedMonthValue>>>;

type StoreAggregatedSourceData = Record<string, AggregatedSourceData>;

type MonthSummary = {
  id: string;
  label: string;
  businessOrder: number;
};

type NoteScope = {
  key: string;
  type: string;
  scopeId: string;
  label: string;
};

type VklNoteTargetMode = 'scope' | 'store' | 'vkl';

type MetricMonthCell = {
  plan: number;
  real: number;
  adjustment: number;
  forecast: number;
  variance: number;
  variancePct: number;
  closedMonth: boolean;
  hasRealData: boolean;
};

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[áä]/g, 'a')
    .replace(/[č]/g, 'c')
    .replace(/[ď]/g, 'd')
    .replace(/[éě]/g, 'e')
    .replace(/[í]/g, 'i')
    .replace(/[ĺľ]/g, 'l')
    .replace(/[ň]/g, 'n')
    .replace(/[óô]/g, 'o')
    .replace(/[ŕř]/g, 'r')
    .replace(/[š]/g, 's')
    .replace(/[ť]/g, 't')
    .replace(/[úů]/g, 'u')
    .replace(/[ý]/g, 'y')
    .replace(/[ž]/g, 'z')
    .replace(/\s+/g, ' ');
}

function normalizeMetricName(value: string) {
  return normalizeText(value || '');
}

function canonicalizeMetric(metric: string) {
  const normalized = normalizeMetricName(metric);
  if (NET_HOURS_SOURCE_ALIASES.has(normalized)) {
    return NET_HOURS_METRIC;
  }
  if (normalized === normalizeMetricName(NET_HOURS_PLAN_VT_METRIC)) {
    return NET_HOURS_PLAN_VT_METRIC;
  }
  if (SHORT_TERM_PN_SOURCES.has(normalized) || normalized === normalizeMetricName('PN Krátkodobé')) {
    return 'PN Krátkodobé';
  }
  return String(metric || '').trim();
}

function isExcludedMetric(metric: string) {
  return EXCLUDED_METRICS.has(canonicalizeMetric(metric));
}

function normalizeImportedMetricValue(metric: string, unit: string | null | undefined, value: number) {
  const numeric = Number(value || 0);
  if ((unit === 'currency' || normalizeMetricName(metric) === normalizeMetricName(TURNOVER_METRIC)) && Number.isInteger(numeric) && Math.abs(numeric) >= 100000000) {
    return numeric / 1000;
  }
  return numeric;
}

function metricCodeFromName(metricName: string) {
  return normalizeMetricName(metricName)
    .replace(/[^a-z0-9+ ]/g, '')
    .replace(/\s+/g, '-');
}

function getMetricFormat(metric: string, explicitUnit?: string | null): MetricFormat {
  const normalized = normalizeMetricName(metric);
  if (explicitUnit === 'currency' || normalized === normalizeMetricName(TURNOVER_METRIC)) {
    return 'currency';
  }
  if (explicitUnit === 'hours' || normalized.indexOf('hodin') > -1 || normalized.indexOf('hodiny') > -1) {
    return 'hours';
  }
  if (explicitUnit === 'fte' || normalized.indexOf('uvazky') > -1 || normalized.indexOf('úväzky') > -1) {
    return 'fte';
  }
  return 'number';
}

function roundMetric(value: number, format: MetricFormat) {
  const numeric = Number(value || 0);
  if (format === 'number' || format === 'fte') {
    return Math.round(numeric * 10) / 10;
  }
  return Math.round(numeric);
}

function normalizeMonthLabel(label: string) {
  const text = String(label || '').trim();
  if (!text) {
    return '';
  }

  try {
    return resolveDashboardMonth(text).label;
  } catch {
    return text;
  }
}

function resolveDashboardMonth(input: string) {
  const text = String(input || '').trim();

  try {
    const resolved = resolveMonthLabel(text);
    return {
      ...resolved,
      label: `${DASHBOARD_MONTH_LABELS_EN[resolved.monthNumber - 1]} ${resolved.year}`,
    };
  } catch {
    const parts = text.split(/\s+/);
    if (parts.length < 2) {
      throw new Error(`Neplatný formát mesiaca: ${input}`);
    }

    const year = Number(parts.at(-1));
    const monthName = normalizeMetricName(parts.slice(0, -1).join(' '));
    const monthIndex = DASHBOARD_MONTH_ALIASES[monthName];
    if (Number.isNaN(year) || monthIndex == null) {
      throw new Error(`Neznámy mesiac: ${input}`);
    }

    const monthNumber = monthIndex + 1;
    const businessYear = monthIndex >= BUSINESS_YEAR_START_MONTH_INDEX ? year : year - 1;
    const businessOrder = (monthIndex - BUSINESS_YEAR_START_MONTH_INDEX + 12) % 12;
    return {
      id: `${year}-${String(monthNumber).padStart(2, '0')}`,
      label: `${DASHBOARD_MONTH_LABELS_EN[monthIndex]} ${year}`,
      year,
      monthNumber,
      businessYear,
      businessOrder,
    };
  }
}

function isClosedMonth(label: string) {
  try {
    const resolved = resolveDashboardMonth(label);
    const current = new Date();
    const currentMonthStart = new Date(current.getFullYear(), current.getMonth(), 1);
    const monthStart = new Date(resolved.year, resolved.monthNumber - 1, 1);
    return monthStart.getTime() < currentMonthStart.getTime();
  } catch {
    return false;
  }
}

function sumValues(values: number[]) {
  return values.reduce((sum, value) => sum + Number(value || 0), 0);
}

function emptyMetricNotes() {
  return {
    VOD: { text: '', author: '', updatedAt: '' },
    VKL: { text: '', author: '', updatedAt: '' },
  };
}

function sanitizeStoreDisplayName(storeId: string, storeName?: string | null) {
  const normalizedStoreId = String(storeId || '').trim();
  let cleanedName = String(storeName || '').trim().replace(/\s+/g, ' ');
  if (!normalizedStoreId || !cleanedName) {
    return cleanedName;
  }

  const parts = cleanedName.split(' ');
  while (parts.length) {
    if (normalizeMetricName(parts[0]) !== normalizeMetricName(normalizedStoreId)) {
      break;
    }
    parts.shift();
    cleanedName = parts.join(' ').trim();
  }

  return cleanedName;
}

function buildStoreDisplayLabel(storeId: string, storeName?: string | null) {
  const normalizedStoreId = String(storeId || '').trim();
  const cleanedStoreName = sanitizeStoreDisplayName(normalizedStoreId, storeName);
  return [normalizedStoreId, cleanedStoreName].filter(Boolean).join(' ');
}

async function getStructureData(): Promise<StructureData> {
  const stores = await prisma.store.findMany({ orderBy: { id: 'asc' } });
  const gfs = new Set<string>();
  const vkls = new Set<string>();
  const storeToHierarchy: StructureData['storeToHierarchy'] = {};
  const gfToStores: StructureData['gfToStores'] = {};
  const vklToStores: StructureData['vklToStores'] = {};
  const vklToGf: StructureData['vklToGf'] = {};

  for (const store of stores) {
    const gf = String(store.gfName || '').trim();
    const vkl = String(store.vklName || '').trim();
    if (!gf || !vkl) {
      continue;
    }

    gfs.add(gf);
    vkls.add(vkl);
    storeToHierarchy[store.id] = { gf, vkl };
    gfToStores[gf] = gfToStores[gf] || [];
    vklToStores[vkl] = vklToStores[vkl] || [];
    gfToStores[gf].push(store.id);
    vklToStores[vkl].push(store.id);
    vklToGf[vkl] = gf;
  }

  return {
    gfs: Array.from(gfs).sort(),
    vkls: Array.from(vkls).sort(),
    storeToHierarchy,
    gfToStores,
    vklToStores,
    vklToGf,
  };
}

async function authenticateUser(loginValue: string, context: 'dashboard' | 'summary' = 'dashboard'): Promise<AuthenticatedUser> {
  const lookup = String(loginValue || '').trim().toLowerCase();
  if (!lookup) {
    throw new Error('Zadaj email alebo test identifikátor.');
  }

  const [user, stores, userCount] = await Promise.all([
    prisma.user.findUnique({ where: { email: lookup } }),
    prisma.store.findMany({ orderBy: { id: 'asc' } }),
    prisma.user.count(),
  ]);

  if (user) {
    if (user.role === 'ADMIN' && context === 'dashboard') {
      throw new Error('Admin účet má prístup iba do sumáru, nie do filiálkového dashboardu.');
    }

    let accessibleStoreIds: string[] = [];
    if (user.role === 'VOD' && user.primaryStoreId) {
      accessibleStoreIds = [user.primaryStoreId];
    } else if (user.role === 'GF' && user.gfName) {
      accessibleStoreIds = stores.filter((store) => store.gfName === user.gfName).map((store) => store.id);
    } else if (user.role === 'VKL' && user.vklName) {
      accessibleStoreIds = stores.filter((store) => store.vklName === user.vklName).map((store) => store.id);
    } else {
      accessibleStoreIds = stores.map((store) => store.id);
    }

    return {
      role: user.role,
      displayName: user.name || user.email,
      email: user.email,
      gfName: user.gfName || undefined,
      vklName: user.vklName || undefined,
      primaryStoreId: user.primaryStoreId || undefined,
      accessibleStoreIds,
    };
  }

  const storeMatch = stores.find((store) => store.id.toLowerCase() === lookup);
  if (storeMatch) {
    return {
      role: 'VOD',
      displayName: `VOD ${storeMatch.id}`,
      email: lookup.includes('@') ? lookup : undefined,
      gfName: storeMatch.gfName || undefined,
      vklName: storeMatch.vklName || undefined,
      primaryStoreId: storeMatch.id,
      accessibleStoreIds: [storeMatch.id],
    };
  }

  if (userCount === 0 && lookup.includes('@')) {
    return {
      role: 'VKL',
      displayName: lookup,
      email: lookup,
      gfName: undefined,
      vklName: 'ALL',
      primaryStoreId: undefined,
      accessibleStoreIds: stores.map((store) => store.id),
    };
  }

  throw new Error('Používateľ nebol nájdený v SQL databáze.');
}

async function getStoreNames() {
  const stores = await prisma.store.findMany({ orderBy: { id: 'asc' } });
  return stores.reduce<Record<string, string>>((result, store) => {
    result[store.id] = store.name;
    return result;
  }, {});
}

function resolveScope(user: AuthenticatedUser, selectedScope: string, structure: StructureData, storeNames: Record<string, string>): DashboardScope {
  const scopeValue = String(selectedScope || '').trim();
  const allowedStores = user.accessibleStoreIds.slice();

  if (!scopeValue || scopeValue === 'ALL') {
    if (user.role === 'VOD' && user.primaryStoreId) {
      return {
        id: user.primaryStoreId,
        type: 'STORE',
        label: buildStoreDisplayLabel(user.primaryStoreId, storeNames[user.primaryStoreId]),
        storeIds: [user.primaryStoreId],
      };
    }

    return {
      id: 'ALL',
      type: 'AGGREGATE',
      label: user.role === 'GF' ? 'Sumár GF' : 'Sumár VKL',
      storeIds: allowedStores,
    };
  }

  if (!allowedStores.includes(scopeValue)) {
    throw new Error('Nemáš prístup k zvolenému scope.');
  }

  return {
    id: scopeValue,
    type: 'STORE',
    label: buildStoreDisplayLabel(scopeValue, storeNames[scopeValue]),
    storeIds: [scopeValue],
  };
}

function buildAvailableScopes(user: AuthenticatedUser, storeNames: Record<string, string>): DashboardScopeOption[] {
  const scopes: DashboardScopeOption[] = [];

  if (user.role !== 'VOD') {
    scopes.push({
      id: 'ALL',
      label: user.role === 'GF' ? 'Sumár GF' : 'Sumár VKL',
      type: 'AGGREGATE',
    });
  }

  user.accessibleStoreIds.forEach((storeId) => {
    scopes.push({
      id: storeId,
      label: buildStoreDisplayLabel(storeId, storeNames[storeId]),
      type: 'STORE',
    });
  });

  return scopes;
}

async function loadMonthlyDataset(storeIds: string[]) {
  const rows = await prisma.monthlyValue.findMany({
    where: {
      storeId: { in: storeIds },
      source: { in: ['PLAN', 'IST', 'VOD'] },
    },
    include: {
      month: true,
      metric: true,
    },
  });

  const monthMap = new Map<string, MonthSummary>();
  const aggregated: AggregatedSourceData = { PLAN: {}, IST: {}, VOD: {} };
  const storeAggregatedByStoreId: StoreAggregatedSourceData = {};
  const metricMeta = new Map<string, { unit: string | null }>();

  for (const row of rows) {
    monthMap.set(row.monthId, {
      id: row.monthId,
      label: row.month.label,
      businessOrder: row.month.businessOrder,
    });

    const canonicalMetric = canonicalizeMetric(row.metric.displayName);
    const normalizedValue = normalizeImportedMetricValue(canonicalMetric, row.metric.unit, Number(row.value || 0));
    metricMeta.set(canonicalMetric, { unit: row.metric.unit });
    aggregated[row.source as SourceName][canonicalMetric] = aggregated[row.source as SourceName][canonicalMetric] || {};
    aggregated[row.source as SourceName][canonicalMetric][row.monthId] = aggregated[row.source as SourceName][canonicalMetric][row.monthId] || { value: 0, present: false };
    aggregated[row.source as SourceName][canonicalMetric][row.monthId].value += normalizedValue;
    aggregated[row.source as SourceName][canonicalMetric][row.monthId].present = aggregated[row.source as SourceName][canonicalMetric][row.monthId].present || Boolean(row.present);

    storeAggregatedByStoreId[row.storeId] = storeAggregatedByStoreId[row.storeId] || { PLAN: {}, IST: {}, VOD: {} };
    storeAggregatedByStoreId[row.storeId][row.source as SourceName][canonicalMetric] = storeAggregatedByStoreId[row.storeId][row.source as SourceName][canonicalMetric] || {};
    storeAggregatedByStoreId[row.storeId][row.source as SourceName][canonicalMetric][row.monthId] = storeAggregatedByStoreId[row.storeId][row.source as SourceName][canonicalMetric][row.monthId] || { value: 0, present: false };
    storeAggregatedByStoreId[row.storeId][row.source as SourceName][canonicalMetric][row.monthId].value += normalizedValue;
    storeAggregatedByStoreId[row.storeId][row.source as SourceName][canonicalMetric][row.monthId].present = storeAggregatedByStoreId[row.storeId][row.source as SourceName][canonicalMetric][row.monthId].present || Boolean(row.present);
  }

  const months = Array.from(monthMap.values()).sort((left, right) => left.businessOrder - right.businessOrder);
  return { aggregated, months, metricMeta, storeAggregatedByStoreId };
}

function getAggregatedValue(sourceData: AggregatedSourceData, source: SourceName, metric: string, monthId: string) {
  return sourceData[source][metric]?.[monthId]?.value || 0;
}

function hasAggregatedValue(sourceData: AggregatedSourceData, source: SourceName, metric: string, monthId: string) {
  return Boolean(sourceData[source][metric]?.[monthId]?.present);
}

function hasMeaningfulSourceMonthData(sourceData: AggregatedSourceData, source: SourceName, monthId: string) {
  return Object.keys(sourceData[source] || {}).some((metric) => {
    const monthValue = sourceData[source][metric]?.[monthId];
    return Boolean(monthValue?.present) && Math.abs(Number(monthValue?.value || 0)) > 0.0001;
  });
}

function getCanonicalMetrics(sourceData: AggregatedSourceData) {
  const metrics = new Set<string>([CLEAN_PERFORMANCE_METRIC]);
  (Object.keys(sourceData) as SourceName[]).forEach((source) => {
    Object.keys(sourceData[source] || {}).forEach((metric) => {
      if (!isExcludedMetric(metric)) {
        metrics.add(metric);
      }
    });
  });

  const hasNetHours = (Object.keys(sourceData) as SourceName[]).some((source) => {
    return Boolean(sourceData[source][NET_HOURS_METRIC]) || Boolean(sourceData[source][NET_HOURS_PLAN_VT_METRIC]);
  });
  if (hasNetHours) {
    metrics.add(NET_HOURS_METRIC);
  }

  const hasTurnover = (Object.keys(sourceData) as SourceName[]).some((source) => Boolean(sourceData[source][TURNOVER_METRIC]));
  if (hasTurnover) {
    metrics.add(TURNOVER_METRIC);
  }

  return Array.from(metrics).sort((left, right) => {
    const leftIndex = UI_METRIC_ORDER.indexOf(left);
    const rightIndex = UI_METRIC_ORDER.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right, 'sk');
    }
    if (leftIndex === -1) {
      return 1;
    }
    if (rightIndex === -1) {
      return -1;
    }
    return leftIndex - rightIndex;
  });
}

function getDisplayedRealValue(metric: string, cell: MetricMonthCell) {
  if (cell.hasRealData) {
    return cell.real;
  }
  return PLAN_AS_PENDING_DELTA_METRICS.has(canonicalizeMetric(metric)) ? cell.plan : cell.real;
}

function getWorkforceStructureBandWeightedValue(sourceData: AggregatedSourceData, source: SourceName, monthId: string) {
  return WORKFORCE_STRUCTURE_BANDS.reduce((sum, band) => {
    return sum + (getAggregatedValue(sourceData, source, band.key, monthId) * band.fteWeight);
  }, 0);
}

function hasWorkforceStructureBandData(sourceData: AggregatedSourceData, source: SourceName, monthId: string) {
  return WORKFORCE_STRUCTURE_BANDS.some((band) => hasAggregatedValue(sourceData, source, band.key, monthId));
}

function hasNonZeroWorkforceStructureBandData(sourceData: AggregatedSourceData, source: SourceName, monthId: string) {
  return WORKFORCE_STRUCTURE_BANDS.some((band) => {
    if (!hasAggregatedValue(sourceData, source, band.key, monthId)) {
      return false;
    }
    return Math.abs(getAggregatedValue(sourceData, source, band.key, monthId)) > 0.0001;
  });
}

function getStructureDays(sourceData: AggregatedSourceData, monthId: string) {
  return getAggregatedValue(sourceData, 'PLAN', WORKING_DAYS_METRIC, monthId)
    + getAggregatedValue(sourceData, 'PLAN', CLOSED_HOLIDAY_METRIC, monthId);
}

function calculateWorkforceStructureDailyHours(sourceData: AggregatedSourceData, source: SourceName, monthId: string) {
  return WORKFORCE_STRUCTURE_BANDS.reduce((sum, band) => {
    return sum + (getAggregatedValue(sourceData, source, band.key, monthId) * band.hoursWeight);
  }, 0);
}

function shouldUseBandDerivedStructureValue(directValue: number, derivedValue: number) {
  const directMagnitude = Math.abs(Number(directValue || 0));
  const derivedMagnitude = Math.abs(Number(derivedValue || 0));

  if (derivedMagnitude <= 0.0001) {
    return false;
  }
  if (directMagnitude <= 0.0001) {
    return true;
  }

  const ratio = derivedMagnitude / directMagnitude;
  return ratio >= 0.25 && ratio <= 4;
}

function calculateWorkforceStructurePlanFte(sourceData: AggregatedSourceData, monthId: string) {
  const directFte = getAggregatedValue(sourceData, 'PLAN', WORKFORCE_STRUCTURE_METRIC, monthId);
  if (hasWorkforceStructureBandData(sourceData, 'PLAN', monthId)) {
    const derivedFte = getWorkforceStructureBandWeightedValue(sourceData, 'PLAN', monthId);
    if (shouldUseBandDerivedStructureValue(directFte, derivedFte)) {
      return derivedFte;
    }
  }

  if (Math.abs(directFte) > 0.0001) {
    return directFte;
  }

  const structureDays = getStructureDays(sourceData, monthId);
  const directHours = getAggregatedValue(sourceData, 'PLAN', STRUCTURE_HOURS_METRIC, monthId);
  const denominator = structureDays * FULL_TIME_DAILY_HOURS;
  return denominator ? directHours / denominator : 0;
}

function calculateStructureHoursPlanValue(sourceData: AggregatedSourceData, monthId: string) {
  const directHours = getAggregatedValue(sourceData, 'PLAN', STRUCTURE_HOURS_METRIC, monthId);
  if (hasWorkforceStructureBandData(sourceData, 'PLAN', monthId)) {
    const derivedHours = calculateWorkforceStructureDailyHours(sourceData, 'PLAN', monthId) * getStructureDays(sourceData, monthId);
    if (shouldUseBandDerivedStructureValue(directHours, derivedHours)) {
      return derivedHours;
    }
  }

  if (Math.abs(directHours) > 0.0001) {
    return directHours;
  }

  return calculateWorkforceStructurePlanFte(sourceData, monthId) * getStructureDays(sourceData, monthId) * FULL_TIME_DAILY_HOURS;
}

function hasExplicitStructureAdjustment(sourceData: AggregatedSourceData, monthId: string) {
  if (hasNonZeroWorkforceStructureBandData(sourceData, 'VOD', monthId)) {
    return true;
  }
  if (Math.abs(getAggregatedValue(sourceData, 'VOD', WORKFORCE_STRUCTURE_METRIC, monthId)) > 0.0001) {
    return true;
  }
  if (Math.abs(getAggregatedValue(sourceData, 'VOD', STRUCTURE_HOURS_METRIC, monthId)) > 0.0001) {
    return true;
  }
  return false;
}

function calculateWorkforceStructureForecastFte(
  sourceData: AggregatedSourceData,
  monthId: string,
  storeAggregatedByStoreId?: StoreAggregatedSourceData,
) {
  const planFte = calculateWorkforceStructurePlanFte(sourceData, monthId);
  if (!hasExplicitStructureAdjustment(sourceData, monthId)) {
    return planFte;
  }

  const effectiveBands = buildEffectiveWorkforceBands(sourceData, monthId, storeAggregatedByStoreId);
  if (effectiveBands.hasBandAdjustments) {
    const derivedFte = effectiveBands.bands.reduce((sum, band) => sum + (band.count * band.fteWeight), 0);
    if (shouldUseBandDerivedStructureValue(planFte, derivedFte)) {
      return derivedFte;
    }
  }

  const workforceDelta = getAggregatedValue(sourceData, 'VOD', WORKFORCE_STRUCTURE_METRIC, monthId);
  if (Math.abs(workforceDelta) > 0.0001) {
    return planFte + workforceDelta;
  }

  const structureHoursDelta = getAggregatedValue(sourceData, 'VOD', STRUCTURE_HOURS_METRIC, monthId);
  if (Math.abs(structureHoursDelta) > 0.0001) {
    const structureDays = getStructureDays(sourceData, monthId);
    const denominator = structureDays * FULL_TIME_DAILY_HOURS;
    return denominator ? (calculateStructureHoursPlanValue(sourceData, monthId) + structureHoursDelta) / denominator : 0;
  }

  return planFte;
}

function calculateStructureHoursForecastValue(
  sourceData: AggregatedSourceData,
  monthId: string,
  storeAggregatedByStoreId?: StoreAggregatedSourceData,
) {
  const planHours = calculateStructureHoursPlanValue(sourceData, monthId);
  const structureDays = getStructureDays(sourceData, monthId);
  if (!hasExplicitStructureAdjustment(sourceData, monthId)) {
    return planHours;
  }

  const effectiveBands = buildEffectiveWorkforceBands(sourceData, monthId, storeAggregatedByStoreId);
  if (effectiveBands.hasBandAdjustments) {
    const derivedHours = effectiveBands.bands.reduce((sum, band) => sum + (band.count * band.hoursWeight), 0) * structureDays;
    if (shouldUseBandDerivedStructureValue(planHours, derivedHours)) {
      return derivedHours;
    }
  }

  const structureHoursDelta = getAggregatedValue(sourceData, 'VOD', STRUCTURE_HOURS_METRIC, monthId);
  if (Math.abs(structureHoursDelta) > 0.0001) {
    return planHours + structureHoursDelta;
  }

  const workforceDelta = getAggregatedValue(sourceData, 'VOD', WORKFORCE_STRUCTURE_METRIC, monthId);
  if (Math.abs(workforceDelta) > 0.0001) {
    return (calculateWorkforceStructurePlanFte(sourceData, monthId) + workforceDelta) * structureDays * FULL_TIME_DAILY_HOURS;
  }

  return planHours;
}

function calculateNetHoursDerivedAdjustment(sourceData: AggregatedSourceData, monthId: string) {
  const structureDelta = calculateStructureHoursForecastValue(sourceData, monthId) - calculateStructureHoursPlanValue(sourceData, monthId);
  return computeNetHoursDelta(structureDelta, (metricName) => getAggregatedValue(sourceData, 'VOD', metricName, monthId));
}

function buildEmptyWorkforceStructureMix() {
  return {
    bands: [],
    totalAdjustment: 0,
    hasAnyData: false,
    isStructureMix: true,
  };
}

function buildWorkforceStructureMix(sourceData: AggregatedSourceData, source: SourceName, monthId: string) {
  const bands = WORKFORCE_STRUCTURE_BANDS.map((band) => ({
    key: band.key,
    label: band.label,
    fteWeight: band.fteWeight,
    hoursWeight: band.hoursWeight,
    count: Number(getAggregatedValue(sourceData, source, band.key, monthId) || 0),
  }));

  return {
    bands,
    totalAdjustment: roundMetric(bands.reduce((sum, band) => sum + (band.count * band.fteWeight), 0), 'fte'),
    isStructureMix: true,
  };
}

function buildActualWorkforceStructureMix(sourceData: AggregatedSourceData, monthId: string) {
  const bands = WORKFORCE_STRUCTURE_BANDS.map((band) => {
    const hasData = hasAggregatedValue(sourceData, 'IST', band.key, monthId);
    return {
      key: band.key,
      label: band.label,
      fteWeight: band.fteWeight,
      hoursWeight: band.hoursWeight,
      count: Number(getAggregatedValue(sourceData, 'IST', band.key, monthId) || 0),
      hasData,
    };
  });
  const hasAnyData = bands.some((band) => band.hasData);

  return {
    bands,
    totalAdjustment: hasAnyData ? roundMetric(bands.reduce((sum, band) => sum + (band.count * band.fteWeight), 0), 'fte') : 0,
    hasAnyData,
    isStructureMix: true,
  };
}

function buildEffectiveWorkforceBands(
  sourceData: AggregatedSourceData,
  monthId: string,
  storeAggregatedByStoreId?: StoreAggregatedSourceData,
) {
  const storeDatasets = Object.values(storeAggregatedByStoreId || {}).filter(Boolean);
  const shouldUseStoreFallback = storeDatasets.length > 1;
  let hasBandAdjustments = false;

  const bands = WORKFORCE_STRUCTURE_BANDS.map((band) => {
    const count = shouldUseStoreFallback
      ? storeDatasets.reduce((sum, storeSourceData) => {
        const storeHasBandAdjustment = hasNonZeroWorkforceStructureBandData(storeSourceData, 'VOD', monthId);
        if (storeHasBandAdjustment) {
          hasBandAdjustments = true;
        }
        const effectiveValue = storeHasBandAdjustment && hasAggregatedValue(storeSourceData, 'VOD', band.key, monthId)
          ? getAggregatedValue(storeSourceData, 'VOD', band.key, monthId)
          : getAggregatedValue(storeSourceData, 'PLAN', band.key, monthId);
        return sum + Number(effectiveValue || 0);
      }, 0)
      : hasNonZeroWorkforceStructureBandData(sourceData, 'VOD', monthId) && hasAggregatedValue(sourceData, 'VOD', band.key, monthId)
        ? getAggregatedValue(sourceData, 'VOD', band.key, monthId)
        : getAggregatedValue(sourceData, 'PLAN', band.key, monthId);
    return {
      key: band.key,
      label: band.label,
      fteWeight: band.fteWeight,
      hoursWeight: band.hoursWeight,
      count: Number(count || 0),
    };
  });

  if (!shouldUseStoreFallback) {
    hasBandAdjustments = hasNonZeroWorkforceStructureBandData(sourceData, 'VOD', monthId);
  }

  return { bands, hasBandAdjustments };
}

function buildEffectiveWorkforceStructureMix(
  sourceData: AggregatedSourceData,
  monthId: string,
  storeAggregatedByStoreId?: StoreAggregatedSourceData,
) {
  const { bands } = buildEffectiveWorkforceBands(sourceData, monthId, storeAggregatedByStoreId);

  return {
    bands,
    totalAdjustment: roundMetric(bands.reduce((sum, band) => sum + (band.count * band.fteWeight), 0), 'fte'),
    isStructureMix: true,
  };
}

function mergeWorkforceStructureMixReferences(effectiveMix: ReturnType<typeof buildWorkforceStructureMix>, planMix: ReturnType<typeof buildWorkforceStructureMix>, realMix: ReturnType<typeof buildActualWorkforceStructureMix>) {
  const planBandsByKey = (planMix?.bands || []).reduce<Record<string, (typeof planMix.bands)[number]>>((result, band) => {
    result[band.key] = band;
    return result;
  }, {});
  const realBandsByKey = (realMix?.bands || []).reduce<Record<string, (typeof realMix.bands)[number]>>((result, band) => {
    result[band.key] = band;
    return result;
  }, {});

  return {
    bands: (effectiveMix?.bands || []).map((band) => {
      const planBand = planBandsByKey[band.key];
      const realBand = realBandsByKey[band.key];
      return {
        key: band.key,
        label: band.label,
        fteWeight: band.fteWeight,
        hoursWeight: band.hoursWeight,
        count: Number(band.count || 0),
        planCount: Number(planBand?.count || 0),
        realCount: Number(realBand?.count || 0),
        hasRealCount: Boolean(realBand?.hasData),
      };
    }),
    totalAdjustment: Number(effectiveMix?.totalAdjustment || 0),
    planTotalAdjustment: Number(planMix?.totalAdjustment || 0),
    realTotalAdjustment: realMix?.hasAnyData ? Number(realMix.totalAdjustment || 0) : null,
    hasRealMix: Boolean(realMix?.hasAnyData),
    isStructureMix: true,
  };
}

function buildWorkforceStructureDisplayModel(
  sourceData: AggregatedSourceData,
  months: MonthSummary[],
  storeAggregatedByStoreId?: StoreAggregatedSourceData,
) {
  const mixValues = months.map((month) => {
    const effectiveMix = buildEffectiveWorkforceStructureMix(sourceData, month.id, storeAggregatedByStoreId);
    const planMix = buildWorkforceStructureMix(sourceData, 'PLAN', month.id);
    const realMix = hasAggregatedValue(sourceData, 'IST', STRUCTURE_HOURS_METRIC, month.id)
      ? buildActualWorkforceStructureMix(sourceData, month.id)
      : buildEmptyWorkforceStructureMix();
    return mergeWorkforceStructureMixReferences(effectiveMix, planMix, realMix);
  });
  const structureHoursPlanValues = months.map((month) => roundMetric(calculateStructureHoursPlanValue(sourceData, month.id), 'hours'));
  const structureHoursRealValues = months.map((month) => (hasAggregatedValue(sourceData, 'IST', STRUCTURE_HOURS_METRIC, month.id)
    ? roundMetric(getAggregatedValue(sourceData, 'IST', STRUCTURE_HOURS_METRIC, month.id), 'hours')
    : null));
  const workforceValues = months.map((month) => roundMetric(calculateWorkforceStructureForecastFte(sourceData, month.id, storeAggregatedByStoreId), 'fte'));
  const structureHoursValues = months.map((month) => roundMetric(calculateStructureHoursForecastValue(sourceData, month.id, storeAggregatedByStoreId), 'hours'));

  return {
    workingDaysValues: months.map((month) => getAggregatedValue(sourceData, 'PLAN', WORKING_DAYS_METRIC, month.id)),
    holidayValues: months.map((month) => getAggregatedValue(sourceData, 'PLAN', CLOSED_HOLIDAY_METRIC, month.id)),
    mixValues,
    structureHoursPlanValues,
    structureHoursRealValues,
    structureHoursRealFlags: months.map((month) => hasAggregatedValue(sourceData, 'IST', STRUCTURE_HOURS_METRIC, month.id)),
    workforceValues,
    structureHoursValues,
    workforceAverageTotal: roundMetric(workforceValues.length ? sumValues(workforceValues) / workforceValues.length : 0, 'fte'),
    structureHoursRealTotal: roundMetric(sumValues(structureHoursRealValues.filter((value): value is number => value != null)), 'hours'),
    structureHoursPlanTotal: roundMetric(sumValues(structureHoursPlanValues), 'hours'),
    structureHoursTotal: roundMetric(sumValues(structureHoursValues), 'hours'),
  };
}

function buildWorkforceStructureSectionRows(
  sourceData: AggregatedSourceData,
  months: MonthSummary[],
  storeAggregatedByStoreId?: StoreAggregatedSourceData,
): MetricRow[] {
  const displayModel = buildWorkforceStructureDisplayModel(sourceData, months, storeAggregatedByStoreId);

  return [
    {
      type: 'static-plan',
      label: WORKING_DAYS_METRIC,
      values: displayModel.workingDaysValues,
      total: sumValues(displayModel.workingDaysValues),
      displayFormat: 'number' as MetricFormat,
    },
    {
      type: 'static-plan',
      label: CLOSED_HOLIDAY_METRIC,
      values: displayModel.holidayValues,
      total: sumValues(displayModel.holidayValues),
      displayFormat: 'number' as MetricFormat,
    },
    {
      type: 'workforce-total',
      label: 'Štruktúra plné úväzky',
      values: displayModel.workforceValues,
      total: displayModel.workforceAverageTotal,
      displayFormat: 'fte' as MetricFormat,
    },
    {
      type: 'structure-mix',
      label: 'Počty úväzkov',
      values: displayModel.mixValues,
      total: '',
    },
    {
      type: 'structure-hours-derived',
      label: STRUCTURE_HOURS_METRIC,
      values: displayModel.structureHoursValues,
      total: displayModel.structureHoursTotal,
      displayFormat: 'hours' as MetricFormat,
    },
    {
      type: 'structure-hours-real',
      label: 'Štruktúra hodín IST',
      values: displayModel.structureHoursRealValues,
      hasRealFlags: displayModel.structureHoursRealFlags,
      total: displayModel.structureHoursRealTotal,
      displayFormat: 'hours' as MetricFormat,
    },
    {
      type: 'structure-hours-plan',
      label: 'Štruktúra hodín plan',
      values: displayModel.structureHoursPlanValues,
      total: displayModel.structureHoursPlanTotal,
      displayFormat: 'hours' as MetricFormat,
    },
  ];
}

function buildAggregateMetricMonthCellFromStores(
  metric: string,
  month: MonthSummary,
  format: MetricFormat,
  storeAggregatedByStoreId?: StoreAggregatedSourceData,
): MetricMonthCell | null {
  const storeDatasets = Object.values(storeAggregatedByStoreId || {}).filter(Boolean);
  if (storeDatasets.length <= 1) {
    return null;
  }

  if (normalizeMetricName(metric) === normalizeMetricName(CLEAN_PERFORMANCE_METRIC)) {
    const turnoverCells = storeDatasets.map((storeSourceData) => buildMetricMonthCell(storeSourceData, TURNOVER_METRIC, month, 'currency'));
    const hoursCells = storeDatasets.map((storeSourceData) => buildMetricMonthCell(storeSourceData, NET_HOURS_METRIC, month, 'hours'));
    const turnoverPlan = sumValues(turnoverCells.map((cell) => cell.plan));
    const turnoverReal = sumValues(turnoverCells.map((cell) => cell.hasRealData ? cell.real : cell.plan));
    const turnoverForecast = sumValues(turnoverCells.map((cell) => cell.forecast));
    const hoursPlan = sumValues(hoursCells.map((cell) => cell.plan));
    const hoursReal = sumValues(hoursCells.map((cell) => cell.hasRealData ? cell.real : cell.plan));
    const hoursForecast = sumValues(hoursCells.map((cell) => cell.forecast));
    const hasRealData = turnoverCells.some((cell) => cell.hasRealData) || hoursCells.some((cell) => cell.hasRealData);
    const plan = turnoverPlan && hoursPlan ? turnoverPlan / hoursPlan : 0;
    const real = turnoverReal && hoursReal ? turnoverReal / hoursReal : 0;
    const forecast = turnoverForecast && hoursForecast ? turnoverForecast / hoursForecast : 0;
    const variance = forecast - (hasRealData ? real : plan);

    return {
      plan: roundMetric(plan, format),
      real: roundMetric(real, format),
      adjustment: 0,
      forecast: roundMetric(forecast, format),
      variance: roundMetric(variance, format),
      variancePct: plan ? variance / plan : 0,
      closedMonth: isClosedMonth(month.label),
      hasRealData,
    };
  }

  const normalizedMetric = normalizeMetricName(metric);
  if (normalizedMetric !== normalizeMetricName(NET_HOURS_METRIC) && normalizedMetric !== normalizeMetricName(TURNOVER_METRIC)) {
    return null;
  }

  const storeCells = storeDatasets.map((storeSourceData) => buildMetricMonthCell(storeSourceData, metric, month, format));
  const plan = sumValues(storeCells.map((cell) => cell.plan));
  const real = sumValues(storeCells.map((cell) => cell.hasRealData ? cell.real : cell.plan));
  const adjustment = sumValues(storeCells.map((cell) => cell.adjustment));
  const forecast = sumValues(storeCells.map((cell) => cell.forecast));
  const hasRealData = storeCells.some((cell) => cell.hasRealData);
  const variance = forecast - (hasRealData ? real : plan);

  return {
    plan: roundMetric(plan, format),
    real: roundMetric(real, format),
    adjustment: roundMetric(adjustment, format),
    forecast: roundMetric(forecast, format),
    variance: roundMetric(variance, format),
    variancePct: plan ? variance / plan : 0,
    closedMonth: isClosedMonth(month.label),
    hasRealData,
  };
}

function buildMetricMonthCell(
  sourceData: AggregatedSourceData,
  metric: string,
  month: MonthSummary,
  format: MetricFormat,
  storeAggregatedByStoreId?: StoreAggregatedSourceData,
): MetricMonthCell {
  const aggregateCell = buildAggregateMetricMonthCellFromStores(metric, month, format, storeAggregatedByStoreId);
  if (aggregateCell) {
    return aggregateCell;
  }

  const closedMonth = isClosedMonth(month.label);
  const hasMeaningfulIstMonthData = hasMeaningfulSourceMonthData(sourceData, 'IST', month.id);

  if (normalizeMetricName(metric) === normalizeMetricName(WORKFORCE_STRUCTURE_METRIC)) {
    const plan = calculateWorkforceStructurePlanFte(sourceData, month.id);
    const hasStructureRealData = hasMeaningfulIstMonthData && (
      hasWorkforceStructureBandData(sourceData, 'IST', month.id)
      || hasAggregatedValue(sourceData, 'IST', metric, month.id)
    );
    const real = hasStructureRealData
      ? getWorkforceStructureBandWeightedValue(sourceData, 'IST', month.id)
      : getAggregatedValue(sourceData, 'IST', metric, month.id);
    const forecast = calculateWorkforceStructureForecastFte(sourceData, month.id);
    const hasRealData = hasStructureRealData;
    const variance = forecast - plan;

    return {
      plan: roundMetric(plan, format),
      real: roundMetric(real, format),
      adjustment: roundMetric(variance, format),
      forecast: roundMetric(forecast, format),
      variance: roundMetric(variance, format),
      variancePct: plan ? variance / plan : 0,
      closedMonth: false,
      hasRealData,
    };
  }

  if (normalizeMetricName(metric) === normalizeMetricName(CLEAN_PERFORMANCE_METRIC)) {
    const turnover = buildMetricMonthCell(sourceData, TURNOVER_METRIC, month, 'currency');
    const hours = buildMetricMonthCell(sourceData, NET_HOURS_METRIC, month, 'hours');
    const plan = turnover.plan && hours.plan ? turnover.plan / hours.plan : 0;
    const real = turnover.real && hours.real ? turnover.real / hours.real : 0;
    const forecast = turnover.forecast && hours.forecast ? turnover.forecast / hours.forecast : 0;
    const variance = forecast - (hours.hasRealData ? real : plan);

    return {
      plan: roundMetric(plan, format),
      real: roundMetric(real, format),
      adjustment: 0,
      forecast: roundMetric(forecast, format),
      variance: roundMetric(variance, format),
      variancePct: plan ? variance / plan : 0,
      closedMonth,
      hasRealData: hasMeaningfulIstMonthData && (hours.hasRealData || turnover.hasRealData),
    };
  }

  const plan = normalizeMetricName(metric) === normalizeMetricName(NET_HOURS_METRIC)
    ? (hasAggregatedValue(sourceData, 'PLAN', NET_HOURS_PLAN_VT_METRIC, month.id)
        ? getAggregatedValue(sourceData, 'PLAN', NET_HOURS_PLAN_VT_METRIC, month.id)
        : getAggregatedValue(sourceData, 'PLAN', metric, month.id))
    : getAggregatedValue(sourceData, 'PLAN', metric, month.id);
  const real = normalizeMetricName(metric) === normalizeMetricName(NET_HOURS_METRIC)
    ? (hasAggregatedValue(sourceData, 'IST', metric, month.id)
        ? getAggregatedValue(sourceData, 'IST', metric, month.id)
        : getAggregatedValue(sourceData, 'IST', NET_HOURS_PLAN_VT_METRIC, month.id))
    : getAggregatedValue(sourceData, 'IST', metric, month.id);
  const hasExplicitNetHoursAdjustment = normalizeMetricName(metric) === normalizeMetricName(NET_HOURS_METRIC)
    && hasAggregatedValue(sourceData, 'VOD', metric, month.id);
  const adjustment = closedMonth
    ? 0
    : (normalizeMetricName(metric) === normalizeMetricName(NET_HOURS_METRIC)
        ? (hasExplicitNetHoursAdjustment
            ? getAggregatedValue(sourceData, 'VOD', metric, month.id)
            : calculateNetHoursDerivedAdjustment(sourceData, month.id))
        : getAggregatedValue(sourceData, 'VOD', metric, month.id));
  const hasRealData = hasMeaningfulIstMonthData && (normalizeMetricName(metric) === normalizeMetricName(NET_HOURS_METRIC)
    ? (hasAggregatedValue(sourceData, 'IST', metric, month.id) || hasAggregatedValue(sourceData, 'IST', NET_HOURS_PLAN_VT_METRIC, month.id))
    : hasAggregatedValue(sourceData, 'IST', metric, month.id));
  const forecastBase = closedMonth && hasRealData ? real : plan + adjustment;
  const variance = forecastBase - plan;

  return {
    plan: roundMetric(plan, format),
    real: roundMetric(real, format),
    adjustment: roundMetric(adjustment, format),
    forecast: roundMetric(forecastBase, format),
    variance: roundMetric(variance, format),
    variancePct: plan ? variance / plan : 0,
    closedMonth,
    hasRealData,
  };
}

function summarizeMetric(metric: string, cells: ReturnType<typeof buildMetricMonthCell>[], format: MetricFormat) {
  if (normalizeMetricName(metric) === normalizeMetricName(CLEAN_PERFORMANCE_METRIC)) {
    return {
      plan: roundMetric(cells.length ? sumValues(cells.map((cell) => cell.plan)) / cells.length : 0, format),
      real: roundMetric(cells.length ? sumValues(cells.map((cell) => cell.real)) / cells.length : 0, format),
      forecast: roundMetric(cells.length ? sumValues(cells.map((cell) => cell.forecast)) / cells.length : 0, format),
    };
  }

  return {
    plan: roundMetric(sumValues(cells.map((cell) => cell.plan)), format),
    real: roundMetric(sumValues(cells.map((cell) => cell.real)), format),
    forecast: roundMetric(sumValues(cells.map((cell) => cell.forecast)), format),
  };
}

function summarizeDisplayedMetric(metric: string, cells: MetricMonthCell[], format: MetricFormat) {
  const displayedRealValues = cells.map((cell) => getDisplayedRealValue(metric, cell));
  if (normalizeMetricName(metric) === normalizeMetricName(CLEAN_PERFORMANCE_METRIC)) {
    return roundMetric(displayedRealValues.length ? sumValues(displayedRealValues) / displayedRealValues.length : 0, format);
  }
  return roundMetric(sumValues(displayedRealValues), format);
}

function buildMetricSection(
  sourceData: AggregatedSourceData,
  months: MonthSummary[],
  metric: string,
  metricMeta: Map<string, { unit: string | null }>,
  storeAggregatedByStoreId?: StoreAggregatedSourceData,
): MetricSection {
  if (normalizeMetricName(metric) === normalizeMetricName(WORKFORCE_STRUCTURE_METRIC)) {
    return {
      metric,
      format: 'fte' as MetricFormat,
      rows: buildWorkforceStructureSectionRows(sourceData, months, storeAggregatedByStoreId),
      breakdown: [],
    };
  }

  const format = getMetricFormat(metric, metricMeta.get(metric)?.unit || null);
  const cells = months.map((month) => buildMetricMonthCell(sourceData, metric, month, format, storeAggregatedByStoreId));
  const summary = summarizeMetric(metric, cells, format);
  const planValues = cells.map((cell) => cell.plan);
  const realValues = cells.map((cell) => getDisplayedRealValue(metric, cell));
  const forecastValues = cells.map((cell) => cell.forecast);
  const deltaValues = cells.map((cell) => roundMetric(cell.forecast - (cell.hasRealData ? cell.real : cell.plan), format));
  const adjustmentValues = cells.map((cell) => cell.adjustment);

  return {
    metric,
    format,
    rows: [
      { type: 'plan', label: 'Ročný Plán', values: planValues, total: summary.plan },
      {
        type: 'real',
        label: 'IST',
        values: realValues,
        total: summarizeDisplayedMetric(metric, cells, format),
        actualValues: cells.map((cell) => cell.real),
        actualTotal: summary.real,
        hasRealFlags: cells.map((cell) => cell.hasRealData),
      },
      { type: 'adjustment', label: 'Úprava VOD', values: adjustmentValues, total: roundMetric(sumValues(adjustmentValues), format), closed: cells.map((cell) => cell.closedMonth) },
      { type: 'forecast', label: 'Úprava VOD', values: forecastValues, total: summary.forecast },
      { type: 'delta', label: 'Δ Delta vs IST', values: deltaValues, total: roundMetric(sumValues(deltaValues), format) },
    ],
    breakdown: [],
  };
}

function buildTable(
  sourceData: AggregatedSourceData,
  months: MonthSummary[],
  metricMeta: Map<string, { unit: string | null }>,
  storeAggregatedByStoreId?: StoreAggregatedSourceData,
): MetricSection[] {
  const metrics = getCanonicalMetrics(sourceData).filter((metric) => !HIDDEN_TABLE_METRICS.has(metric));
  return metrics.map((metric) => buildMetricSection(sourceData, months, metric, metricMeta, storeAggregatedByStoreId));
}

async function buildMetricBreakdowns(user: AuthenticatedUser, scope: DashboardScope, months: MonthSummary[], table: MetricSection[]) {
  if (scope.type !== 'AGGREGATE' || scope.storeIds.length <= 1 || !table.length) {
    return table;
  }

  const stores = await prisma.store.findMany({ where: { id: { in: scope.storeIds } }, orderBy: { id: 'asc' } });
  const storeDatasets = await Promise.all(stores.map(async (store) => {
    const dataset = await loadMonthlyDataset([store.id]);
    return { store, dataset };
  }));

  if (user.role === 'GF') {
    const groupedByVkl = new Map<string, Array<(typeof storeDatasets)[number]>>();
    for (const entry of storeDatasets) {
      const groupKey = String(entry.store.vklName || '').trim() || 'Bez VKL';
      if (!groupedByVkl.has(groupKey)) {
        groupedByVkl.set(groupKey, []);
      }
      groupedByVkl.get(groupKey)?.push(entry);
    }

    const vklDatasets = await Promise.all(Array.from(groupedByVkl.entries()).map(async ([vklName, entries]) => ({
      vklName,
      dataset: await loadMonthlyDataset(entries.map((entry) => entry.store.id)),
      stores: entries,
    })));

    return table.map((section) => ({
      ...section,
      breakdown: vklDatasets.map(({ vklName, dataset, stores: groupedStores }) => ({
        storeId: vklName,
        storeName: vklName,
        displayLabel: vklName,
        rows: buildMetricSection(dataset.aggregated, months, section.metric, dataset.metricMeta, dataset.storeAggregatedByStoreId).rows,
        breakdown: groupedStores.map(({ store, dataset: storeDataset }) => ({
          storeId: store.id,
          storeName: store.name,
          rows: buildMetricSection(storeDataset.aggregated, months, section.metric, storeDataset.metricMeta, storeDataset.storeAggregatedByStoreId).rows,
        })),
      })),
    }));
  }

  return table.map((section) => ({
    ...section,
    breakdown: storeDatasets.map(({ store, dataset }) => ({
      storeId: store.id,
      storeName: store.name,
      rows: buildMetricSection(dataset.aggregated, months, section.metric, dataset.metricMeta, dataset.storeAggregatedByStoreId).rows,
    })),
  }));
}

function buildCharts(table: DashboardPayload['table'], months: string[]) {
  const sectionByMetric = Object.fromEntries(table.map((section) => [normalizeMetricName(section.metric), section]));
  const getNumericRowValues = (metric: string, type: string) => {
    const section = sectionByMetric[normalizeMetricName(metric)];
    const row = section?.rows.find((item) => item.type === type);
    return (row?.values || months.map(() => 0)).map((value) => typeof value === 'number' ? value : 0);
  };

  return {
    obrat: { labels: months, plan: getNumericRowValues(TURNOVER_METRIC, 'plan'), forecast: getNumericRowValues(TURNOVER_METRIC, 'forecast'), real: getNumericRowValues(TURNOVER_METRIC, 'real') },
    hours: { labels: months, plan: getNumericRowValues(NET_HOURS_METRIC, 'plan'), forecast: getNumericRowValues(NET_HOURS_METRIC, 'forecast'), real: getNumericRowValues(NET_HOURS_METRIC, 'real') },
    performance: { labels: months, plan: getNumericRowValues(CLEAN_PERFORMANCE_METRIC, 'plan'), forecast: getNumericRowValues(CLEAN_PERFORMANCE_METRIC, 'forecast'), real: getNumericRowValues(CLEAN_PERFORMANCE_METRIC, 'real') },
    workforce: { labels: months, plan: getNumericRowValues('Štruktúra hodín', 'plan'), forecast: getNumericRowValues('Štruktúra hodín', 'forecast'), real: getNumericRowValues('Štruktúra hodín', 'real'), realFlags: getNumericRowValues('Štruktúra hodín', 'real').map(() => false) },
  };
}

function buildCards(table: DashboardPayload['table']) {
  return PRIMARY_METRICS.map((metric) => {
    const section = table.find((item) => normalizeMetricName(item.metric) === normalizeMetricName(metric));
    const format = section?.format || 'number';
    const plan = Number(section?.rows.find((row) => row.type === 'plan')?.total || 0);
    const real = Number(section?.rows.find((row) => row.type === 'real')?.total || 0);
    const forecast = Number(section?.rows.find((row) => row.type === 'forecast')?.total || 0);
    const variance = forecast - plan;
    return {
      metric,
      value: forecast,
      format,
      detailLabel: 'IST',
      detailLeft: real,
      detailRightLabel: 'Plán',
      detailRight: plan,
      variance,
      variancePct: plan ? variance / plan : 0,
    };
  });
}

async function buildStoresSummary(scope: DashboardScope, months: MonthSummary[]) {
  if (scope.type !== 'AGGREGATE' || scope.storeIds.length <= 1) {
    return [];
  }

  const stores = await prisma.store.findMany({ where: { id: { in: scope.storeIds } }, orderBy: { id: 'asc' } });
  const items = [];

  for (const store of stores) {
    const { aggregated, metricMeta } = await loadMonthlyDataset([store.id]);
    const turnover = summarizeMetric(TURNOVER_METRIC, months.map((month) => buildMetricMonthCell(aggregated, TURNOVER_METRIC, month, getMetricFormat(TURNOVER_METRIC, metricMeta.get(TURNOVER_METRIC)?.unit || 'currency'))), 'currency').forecast;
    const hours = summarizeMetric(NET_HOURS_METRIC, months.map((month) => buildMetricMonthCell(aggregated, NET_HOURS_METRIC, month, 'hours')), 'hours').forecast;
    const performance = summarizeMetric(CLEAN_PERFORMANCE_METRIC, months.map((month) => buildMetricMonthCell(aggregated, CLEAN_PERFORMANCE_METRIC, month, 'number')), 'number').forecast;

    items.push({ id: store.id, label: buildStoreDisplayLabel(store.id, store.name), turnover, hours, performance });
  }

  return items.sort((left, right) => right.turnover - left.turnover);
}

function buildNoteScope(user: AuthenticatedUser, scope: DashboardScope): NoteScope {
  if (scope.type === 'STORE') {
    return { key: `STORE|${scope.id}`, type: 'STORE', scopeId: scope.id, label: scope.label };
  }
  if (user.role === 'GF') {
    return { key: `AGGREGATE|GF|${user.gfName || 'ALL'}`, type: 'AGGREGATE', scopeId: user.gfName || 'ALL', label: scope.label };
  }
  return { key: `AGGREGATE|VKL|${user.vklName || 'ALL'}`, type: 'AGGREGATE', scopeId: user.vklName || 'ALL', label: scope.label };
}

function normalizeVklNoteTargetMode(user: AuthenticatedUser, scope: DashboardScope, requestedMode?: string | null): VklNoteTargetMode {
  if (user.role !== 'VKL' || scope.type !== 'STORE') {
    return 'scope';
  }

  return String(requestedMode || '').trim().toLowerCase() === 'vkl' ? 'vkl' : 'store';
}

function buildVklAggregateNoteScope(user: AuthenticatedUser, scope: DashboardScope, structure: StructureData): NoteScope | null {
  const fallbackVklName = String(user.vklName || structure.storeToHierarchy[scope.id]?.vkl || '').trim();
  if (!fallbackVklName) {
    return null;
  }

  return {
    key: `AGGREGATE|VKL|${fallbackVklName}`,
    type: 'AGGREGATE',
    scopeId: fallbackVklName,
    label: 'Sumár VKL',
  };
}

async function loadLatestNote(scopeKey: string, role: 'VOD' | 'VKL', metricKey: string) {
  return prisma.dashboardNote.findFirst({
    where: {
      scopeKey,
      role,
      metricKey,
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getDashboardDataFromSql(loginValue: string, selectedScope: string): Promise<DashboardPayload> {
  const [structure, storeNames] = await Promise.all([getStructureData(), getStoreNames()]);
  const user = await authenticateUser(loginValue, 'dashboard');
  const scope = resolveScope(user, selectedScope, structure, storeNames);
  const { aggregated, months, metricMeta, storeAggregatedByStoreId } = await loadMonthlyDataset(scope.storeIds);

  if (!months.length) {
    if (scope.type === 'STORE') {
      throw new Error(`Pre filiálku ${scope.label} zatiaľ nie sú v SQL naimportované mesačné dáta.`);
    }

    throw new Error(`Pre scope ${scope.label} zatiaľ nie sú v SQL naimportované mesačné dáta.`);
  }

  const table = await buildMetricBreakdowns(user, scope, months, buildTable(aggregated, months, metricMeta, storeAggregatedByStoreId));
  const noteScope = buildNoteScope(user, scope);

  return {
    generatedAt: new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date()),
    user,
    scope: { ...scope, noteScopeKey: noteScope.key },
    scopes: buildAvailableScopes(user, storeNames),
    months: months.map((month) => month.label),
    cards: buildCards(table),
    charts: buildCharts(table, months.map((month) => month.label)),
    table,
    stores: await buildStoresSummary(scope, months),
  };
}

export async function getScopeNotesFromSql(loginValue: string, selectedScope: string, requestedVklNoteTarget?: string, requestedMetric?: string) {
  const [structure, storeNames] = await Promise.all([getStructureData(), getStoreNames()]);
  const user = await authenticateUser(loginValue, 'dashboard');
  const scope = resolveScope(user, selectedScope, structure, storeNames);
  const notes = emptyMetricNotes();
  const metricKey = String(requestedMetric || '').trim() === GLOBAL_SCOPE_NOTE_METRIC || !String(requestedMetric || '').trim()
    ? GLOBAL_SCOPE_NOTE_METRIC
    : canonicalizeMetric(String(requestedMetric || ''));

  const noteScope = buildNoteScope(user, scope);
  const vklNoteTargetMode = normalizeVklNoteTargetMode(user, scope, requestedVklNoteTarget);
  const baseVodRow = await loadLatestNote(noteScope.key, 'VOD', metricKey);
  const vklScope = vklNoteTargetMode === 'vkl'
    ? buildVklAggregateNoteScope(user, scope, structure)
    : noteScope;
  const baseVklRow = vklScope ? await loadLatestNote(vklScope.key, 'VKL', metricKey) : null;

  if (baseVodRow) {
    notes.VOD = {
      text: baseVodRow.text || '',
      author: baseVodRow.author || '',
      updatedAt: new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'medium' }).format(baseVodRow.updatedAt),
    };
  }

  if (baseVklRow) {
    notes.VKL = {
      text: baseVklRow.text || '',
      author: baseVklRow.author || '',
      updatedAt: new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'medium' }).format(baseVklRow.updatedAt),
    };
  }

  if (user.role === 'VOD' && scope.type === 'STORE' && !String(notes.VKL.text || '').trim()) {
    const fallbackScope = buildVklAggregateNoteScope(user, scope, structure);
    if (fallbackScope) {
      const vklRow = await loadLatestNote(fallbackScope.key, 'VKL', metricKey);
      if (vklRow) {
        notes.VKL = {
          text: vklRow.text || '',
          author: vklRow.author || '',
          updatedAt: new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'medium' }).format(vklRow.updatedAt),
        };
      }
    }
  }

  return notes;
}

export async function getWeeklyVodOverridesFromSql(loginValue: string, selectedScope: string, monthLabel: string): Promise<WeeklyOverridesPayload> {
  const [structure, storeNames] = await Promise.all([getStructureData(), getStoreNames()]);
  const user = await authenticateUser(loginValue, 'dashboard');
  const scope = resolveScope(user, selectedScope, structure, storeNames);
  const normalizedMonth = normalizeMonthLabel(monthLabel);
  if (!normalizedMonth || !scope.storeIds.length) {
    return { scopeId: scope.id, month: normalizedMonth, overrides: {}, storeOverrides: {} };
  }

  const rows = await prisma.weeklyVodOverride.findMany({
    where: {
      storeId: { in: scope.storeIds },
      monthLabel: normalizedMonth,
    },
    orderBy: [{ metric: 'asc' }, { weekIndex: 'asc' }],
  });

  const overrides: WeeklyOverridesPayload['overrides'] = {};
  const storeOverrides: WeeklyOverridesPayload['storeOverrides'] = {};

  for (const row of rows) {
    overrides[row.metric] = overrides[row.metric] || { values: [], distributionMode: row.distributionMode || '' };
    overrides[row.metric].values[row.weekIndex] = Number(overrides[row.metric].values[row.weekIndex] || 0) + Number(row.value || 0);
    if (row.distributionMode) {
      overrides[row.metric].distributionMode = row.distributionMode;
    }

    storeOverrides[row.storeId] = storeOverrides[row.storeId] || {};
    storeOverrides[row.storeId][row.metric] = storeOverrides[row.storeId][row.metric] || { values: [], distributionMode: row.distributionMode || '' };
    storeOverrides[row.storeId][row.metric].values[row.weekIndex] = Number(storeOverrides[row.storeId][row.metric].values[row.weekIndex] || 0) + Number(row.value || 0);
    if (row.distributionMode) {
      storeOverrides[row.storeId][row.metric].distributionMode = row.distributionMode;
    }
  }

  return {
    scopeId: scope.id,
    month: normalizedMonth,
    overrides,
    storeOverrides,
  };
}

export async function saveDashboardChangesToSql(
  loginValue: string,
  selectedScope: string,
  adjustmentUpdates: Array<{ metric: string; month: string; value: number }>,
  noteUpdates: Array<{ metric: string; text: string }>,
  weeklyUpdates: Array<{ metric: string; month: string; weekIndex: number; weekLabel?: string; rangeLabel?: string; value: number; distributionMode?: string }>,
  requestedVklNoteTarget?: string,
) {
  const [structure, storeNames] = await Promise.all([getStructureData(), getStoreNames()]);
  const user = await authenticateUser(loginValue, 'dashboard');
  const scope = resolveScope(user, selectedScope, structure, storeNames);
  const result = {
    savedAdjustments: 0,
    savedWeeklyAdjustments: 0,
    savedNotes: 0,
    updatedAt: new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date()),
  };

  if (adjustmentUpdates.length) {
    if (user.role !== 'VOD' || scope.type !== 'STORE' || scope.storeIds[0] !== user.primaryStoreId) {
      throw new Error('Úpravy VOD môže zapisovať iba VOD používateľ pre svoju filiálku.');
    }

    for (const update of adjustmentUpdates) {
      const canonicalMetric = canonicalizeMetric(update.metric);
      const month = resolveDashboardMonth(update.month);
      const metricCode = metricCodeFromName(canonicalMetric);
      await prisma.metric.upsert({
        where: { code: metricCode },
        update: { displayName: canonicalMetric, unit: getMetricFormat(canonicalMetric), aggregation: 'sum' },
        create: { code: metricCode, displayName: canonicalMetric, unit: getMetricFormat(canonicalMetric), aggregation: 'sum' },
      });
      await prisma.monthlyValue.upsert({
        where: {
          source_storeId_metricCode_monthId: {
            source: 'VOD',
            storeId: scope.storeIds[0],
            metricCode,
            monthId: month.id,
          },
        },
        update: {
          value: Number(update.value || 0),
          present: true,
          importedAt: new Date(),
        },
        create: {
          source: 'VOD',
          storeId: scope.storeIds[0],
          metricCode,
          monthId: month.id,
          value: Number(update.value || 0),
          present: true,
        },
      });
      result.savedAdjustments += 1;
    }
  }

  const touchedWeeklyPairs = new Set<string>();
  adjustmentUpdates.forEach((update) => {
    const canonicalMetric = canonicalizeMetric(update.metric);
    const normalizedMonth = normalizeMonthLabel(update.month);
    if (canonicalMetric && normalizedMonth) {
      touchedWeeklyPairs.add(`${canonicalMetric}|${normalizedMonth}`);
    }
  });
  weeklyUpdates.forEach((update) => {
    const canonicalMetric = canonicalizeMetric(update.metric);
    const normalizedMonth = normalizeMonthLabel(update.month);
    if (canonicalMetric && normalizedMonth) {
      touchedWeeklyPairs.add(`${canonicalMetric}|${normalizedMonth}`);
    }
  });

  if (touchedWeeklyPairs.size) {
    if (user.role !== 'VOD' || scope.type !== 'STORE' || scope.storeIds[0] !== user.primaryStoreId) {
      throw new Error('Týždenné úpravy môže zapisovať iba VOD používateľ pre svoju filiálku.');
    }

    for (const key of touchedWeeklyPairs) {
      const [metric, monthLabel] = key.split('|');
      await prisma.weeklyVodOverride.deleteMany({ where: { storeId: scope.storeIds[0], metric, monthLabel } });
    }
  }

  if (weeklyUpdates.length) {
    for (const update of weeklyUpdates) {
      await prisma.weeklyVodOverride.create({
        data: {
          storeId: scope.storeIds[0],
          metric: canonicalizeMetric(update.metric),
          monthLabel: normalizeMonthLabel(update.month),
          weekIndex: Math.max(0, Number(update.weekIndex || 0)),
          weekLabel: String(update.weekLabel || ''),
          rangeLabel: String(update.rangeLabel || ''),
          value: Number(update.value || 0),
          distributionMode: String(update.distributionMode || ''),
          updatedBy: user.displayName,
        },
      });
      result.savedWeeklyAdjustments += 1;
    }
  }

  if (noteUpdates.length) {
    if (!['VOD', 'VKL'].includes(user.role)) {
      throw new Error('Poznámky môže zapisovať iba VOD alebo VKL.');
    }

    const vklNoteTargetMode = normalizeVklNoteTargetMode(user, scope, requestedVklNoteTarget);
    const noteScope = user.role === 'VKL' && vklNoteTargetMode === 'vkl'
      ? buildVklAggregateNoteScope(user, scope, structure) || buildNoteScope(user, scope)
      : buildNoteScope(user, scope);
    for (const update of noteUpdates) {
      const metricKey = update.metric === GLOBAL_SCOPE_NOTE_METRIC ? GLOBAL_SCOPE_NOTE_METRIC : canonicalizeMetric(update.metric);
      const noteText = String(update.text == null ? '' : update.text).trim();
      if (!noteText) {
        continue;
      }
      await prisma.dashboardNote.upsert({
        where: {
          scopeKey_role_metricKey: {
            scopeKey: noteScope.key,
            role: user.role,
            metricKey,
          },
        },
        update: {
          scopeType: noteScope.type,
          scopeId: noteScope.scopeId,
          scopeLabel: noteScope.label,
          author: user.displayName,
          text: noteText,
          storeId: noteScope.type === 'STORE' ? noteScope.scopeId : null,
          updatedAt: new Date(),
        },
        create: {
          scopeKey: noteScope.key,
          scopeType: noteScope.type,
          scopeId: noteScope.scopeId,
          scopeLabel: noteScope.label,
          metricKey,
          role: user.role,
          author: user.displayName,
          text: noteText,
          storeId: noteScope.type === 'STORE' ? noteScope.scopeId : null,
        },
      });
      result.savedNotes += 1;
    }
  }

  return result;
}