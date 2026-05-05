import { prisma } from '@/lib/prisma';

type MetricUnit = 'currency' | 'hours' | 'number' | 'fte';

type MonthSummary = {
  id: string;
  label: string;
  turnover: number;
  hours: number;
  performance: number;
  structure: number;
  absence: number;
};

type FeaturedMetricConfig = {
  code: string;
  label: string;
  unit: MetricUnit;
  description: string;
  derived?: boolean;
};

export type FeaturedMetricSummary = {
  code: string;
  label: string;
  unit: MetricUnit;
  description: string;
  annualValue: number;
  monthValues: number[];
  peakMonth: string;
  peakValue: number;
};

export type StoreSummary = {
  id: string;
  name: string;
  turnover: number;
  hours: number;
  performance: number;
  structure: number;
};

export type DriverMetric = {
  code: string;
  label: string;
  annualValue: number;
  monthValues: number[];
  unit: string | null;
};

export type PlanDashboardSnapshot = {
  storeCount: number;
  planValueCount: number;
  months: { id: string; label: string }[];
  imports: {
    id: string;
    fileName: string;
    rowCount: number;
    createdAt: Date;
    uploadedBy: string | null;
  }[];
  featuredMetrics: FeaturedMetricSummary[];
  monthlySummary: MonthSummary[];
  topStores: StoreSummary[];
  driverMetrics: DriverMetric[];
  firstMonthLabel: string;
  lastMonthLabel: string;
  bestTurnoverMonth: MonthSummary | null;
  strongestPerformanceMonth: MonthSummary | null;
  highestAbsenceMonth: MonthSummary | null;
};

const TURNOVER_CODE = 'obrat-gj2026';
const HOURS_CODE = 'hodiny-netto-plan-vt';
const PERFORMANCE_CODE = 'cisty-vykon';
const STRUCTURE_CODE = 'struktura-filialky-plne-uvazky';
const STRUCTURE_HOURS_CODE = 'struktura-hodin';
const ABSENCE_CODE = 'dlhodoba-nepritomnost-33+-dni-b';

const FEATURED_METRICS: FeaturedMetricConfig[] = [
  {
    code: TURNOVER_CODE,
    label: 'Obrat GJ2026',
    unit: 'currency',
    description: 'Ročný obchodný plán agregovaný za všetky predajne.',
  },
  {
    code: HOURS_CODE,
    label: 'Hodiny netto',
    unit: 'hours',
    description: 'Plánované netto hodiny z vrstvy PLAN VT.',
  },
  {
    code: PERFORMANCE_CODE,
    label: 'Čistý výkon',
    unit: 'number',
    description: 'Odvodené z obratu a hodín netto za celé obdobie.',
    derived: true,
  },
  {
    code: STRUCTURE_CODE,
    label: 'Štruktúra filiálky',
    unit: 'fte',
    description: 'Súčet plánovaných plných úväzkov naprieč sieťou.',
  },
  {
    code: STRUCTURE_HOURS_CODE,
    label: 'Štruktúra hodín',
    unit: 'hours',
    description: 'Ročný rozpad štruktúry hodín v prevádzke.',
  },
  {
    code: ABSENCE_CODE,
    label: 'PN Dlhodobé',
    unit: 'hours',
    description: 'Dlhodobé absencie ako samostatný plánovací tlak.',
  },
];

function buildMetricMonthKey(metricCode: string, monthId: string) {
  return `${metricCode}::${monthId}`;
}

function buildStoreMetricKey(storeId: string, metricCode: string) {
  return `${storeId}::${metricCode}`;
}

function buildStoreMetricMonthKey(storeId: string, metricCode: string, monthId: string) {
  return `${storeId}::${metricCode}::${monthId}`;
}

function sumMapValue(map: Map<string, number>, key: string, value: number) {
  map.set(key, Number(map.get(key) || 0) + value);
}

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function formatMetricValue(value: number, unit: string | null | undefined) {
  if (unit === 'currency') {
    return new Intl.NumberFormat('sk-SK', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (unit === 'hours') {
    return new Intl.NumberFormat('sk-SK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value);
  }

  if (unit === 'fte' || unit === 'number') {
    return new Intl.NumberFormat('sk-SK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat('sk-SK').format(value);
}

export function formatCompactMetricValue(value: number, unit: string | null | undefined) {
  if (unit === 'currency') {
    if (Math.abs(value) >= 1000000) {
      return `${new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 1 }).format(value / 1000000)} mil. €`;
    }
    if (Math.abs(value) >= 1000) {
      return `${new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 1 }).format(value / 1000)} tis. €`;
    }
  }

  return formatMetricValue(value, unit);
}

export async function getPlanDashboardSnapshot(): Promise<PlanDashboardSnapshot> {
  const [months, imports, storeCount, planValueCount, values] = await Promise.all([
    prisma.month.findMany({
      orderBy: [{ businessYear: 'asc' }, { businessOrder: 'asc' }],
    }),
    prisma.importBatch.findMany({
      where: { source: 'PLAN' },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.store.count(),
    prisma.monthlyValue.count({ where: { source: 'PLAN' } }),
    prisma.monthlyValue.findMany({
      where: { source: 'PLAN' },
      include: {
        month: true,
        metric: true,
        store: true,
      },
    }),
  ]);

  const monthIds = months.map((month) => month.id);
  const monthIdToLabel = new Map(months.map((month) => [month.id, month.label]));
  const metricMonthTotals = new Map<string, number>();
  const storeMetricTotals = new Map<string, number>();
  const storeMetricMonthTotals = new Map<string, number>();
  const metricYearTotals = new Map<string, number>();
  const metricLabels = new Map<string, { label: string; unit: string | null }>();
  const storeNames = new Map<string, string>();

  for (const value of values) {
    sumMapValue(metricMonthTotals, buildMetricMonthKey(value.metricCode, value.monthId), value.value);
    sumMapValue(storeMetricTotals, buildStoreMetricKey(value.storeId, value.metricCode), value.value);
    sumMapValue(storeMetricMonthTotals, buildStoreMetricMonthKey(value.storeId, value.metricCode, value.monthId), value.value);
    sumMapValue(metricYearTotals, value.metricCode, value.value);
    metricLabels.set(value.metricCode, { label: value.metric.displayName, unit: value.metric.unit });
    storeNames.set(value.storeId, value.store.name);
  }

  const monthlySummary = months.map((month) => {
    const turnover = Number(metricMonthTotals.get(buildMetricMonthKey(TURNOVER_CODE, month.id)) || 0);
    const hours = Number(metricMonthTotals.get(buildMetricMonthKey(HOURS_CODE, month.id)) || 0);
    const structure = Number(metricMonthTotals.get(buildMetricMonthKey(STRUCTURE_CODE, month.id)) || 0);
    const absence = Number(metricMonthTotals.get(buildMetricMonthKey(ABSENCE_CODE, month.id)) || 0);
    const performance = hours ? turnover / hours : 0;

    return {
      id: month.id,
      label: month.label,
      turnover,
      hours,
      structure,
      absence,
      performance,
    };
  });

  const featuredMetrics = FEATURED_METRICS.map((metric) => {
    const monthValues = months.map((month) => {
      if (metric.code === PERFORMANCE_CODE) {
        const monthSummary = monthlySummary.find((entry) => entry.id === month.id);
        return monthSummary ? monthSummary.performance : 0;
      }

      return Number(metricMonthTotals.get(buildMetricMonthKey(metric.code, month.id)) || 0);
    });

    const annualValue = metric.code === PERFORMANCE_CODE
      ? (() => {
          const turnover = Number(metricYearTotals.get(TURNOVER_CODE) || 0);
          const hours = Number(metricYearTotals.get(HOURS_CODE) || 0);
          return hours ? turnover / hours : 0;
        })()
      : metric.code === STRUCTURE_CODE
        ? average(monthValues)
        : metric.code === PERFORMANCE_CODE
          ? average(monthValues)
          : monthValues.reduce((sum, value) => sum + value, 0);

    const peakValue = Math.max(...monthValues, 0);
    const peakMonthIndex = monthValues.findIndex((value) => value === peakValue);

    return {
      code: metric.code,
      label: metric.label,
      unit: metric.unit,
      description: metric.description,
      annualValue,
      monthValues,
      peakMonth: peakMonthIndex > -1 ? months[peakMonthIndex].label : 'bez dát',
      peakValue,
    };
  });

  const topStores = Array.from(storeNames.entries())
    .map(([storeId, storeName]) => {
      const turnover = Number(storeMetricTotals.get(buildStoreMetricKey(storeId, TURNOVER_CODE)) || 0);
      const hours = Number(storeMetricTotals.get(buildStoreMetricKey(storeId, HOURS_CODE)) || 0);
      const structureValues = monthIds.map((monthId) => Number(storeMetricMonthTotals.get(buildStoreMetricMonthKey(storeId, STRUCTURE_CODE, monthId)) || 0));
      return {
        id: storeId,
        name: storeName,
        turnover,
        hours,
        performance: hours ? turnover / hours : 0,
        structure: average(structureValues),
      };
    })
    .sort((left, right) => right.turnover - left.turnover)
    .slice(0, 10);

  const excludedDriverCodes = new Set(FEATURED_METRICS.map((metric) => metric.code));
  const driverMetrics = Array.from(metricYearTotals.entries())
    .filter(([metricCode]) => !excludedDriverCodes.has(metricCode) && !metricCode.startsWith('struktura-filialky-'))
    .map(([metricCode, annualValue]) => ({
      code: metricCode,
      label: metricLabels.get(metricCode)?.label || metricCode,
      annualValue,
      monthValues: monthIds.map((monthId) => Number(metricMonthTotals.get(buildMetricMonthKey(metricCode, monthId)) || 0)),
      unit: metricLabels.get(metricCode)?.unit || null,
    }))
    .sort((left, right) => Math.abs(right.annualValue) - Math.abs(left.annualValue))
    .slice(0, 8);

  const bestTurnoverMonth = monthlySummary.length
    ? monthlySummary.reduce((best, current) => current.turnover > best.turnover ? current : best)
    : null;
  const strongestPerformanceMonth = monthlySummary.length
    ? monthlySummary.reduce((best, current) => current.performance > best.performance ? current : best)
    : null;
  const highestAbsenceMonth = monthlySummary.length
    ? monthlySummary.reduce((best, current) => current.absence > best.absence ? current : best)
    : null;

  return {
    storeCount,
    planValueCount,
    months: months.map((month) => ({ id: month.id, label: month.label })),
    imports: imports.map((item) => ({
      id: item.id,
      fileName: item.fileName,
      rowCount: item.rowCount,
      createdAt: item.createdAt,
      uploadedBy: item.uploadedBy,
    })),
    featuredMetrics,
    monthlySummary,
    topStores,
    driverMetrics,
    firstMonthLabel: monthIdToLabel.get(monthIds[0] || '') || '',
    lastMonthLabel: monthIdToLabel.get(monthIds[monthIds.length - 1] || '') || '',
    bestTurnoverMonth,
    strongestPerformanceMonth,
    highestAbsenceMonth,
  };
}
