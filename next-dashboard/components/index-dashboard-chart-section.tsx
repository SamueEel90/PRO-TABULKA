'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { DashboardPayload, DashboardCharts, MetricFormat } from '@/lib/legacy/contracts';

type ChartModeKey = 'obrat' | 'hours' | 'workforce' | 'performance';
type ChartMonthFilterKey = 'all' | 'q1' | 'q2' | 'q3' | 'q4' | 'open' | 'closed';

type ChartModeDefinition = {
  label: string;
  title: string;
  subtitle: string;
};

type ChartFilterDefinition = {
  label: string;
  suffix: string;
};

type ChartEventDetail = {
  payload: DashboardPayload;
  charts: DashboardCharts;
  activeMode: ChartModeKey;
  activeMonthFilter: ChartMonthFilterKey;
  collapsed: boolean;
  chartModes: Record<ChartModeKey, ChartModeDefinition>;
  chartMonthFilters: Record<ChartMonthFilterKey, ChartFilterDefinition>;
};

type ChartState = ChartEventDetail | null;

declare global {
  interface Window {
    Chart?: new (context: HTMLCanvasElement, config: unknown) => {
      destroy: () => void;
      update: () => void;
      data: unknown;
      options: unknown;
    };
  }
}

const defaultChartModes: Record<ChartModeKey, ChartModeDefinition> = {
  obrat: {
    label: 'Obrat',
    title: 'Obrat GJ 2026',
    subtitle: 'Ročný Plán, IST a Úprava VOD za celý obchodný rok.',
  },
  hours: {
    label: 'Hodiny netto',
    title: 'Hodiny netto GJ 2026',
    subtitle: 'Ročný Plán, IST a Úprava VOD naprieč celým rokom.',
  },
  workforce: {
    label: 'Štruktúra hodín',
    title: 'Štruktúra hodín GJ 2026',
    subtitle: 'Ročný Plán, IST a aktuálna úprava štruktúry hodín v jednom grafe.',
  },
  performance: {
    label: 'Čistý výkon',
    title: 'Čistý výkon GJ 2026',
    subtitle: 'Ročný Plán, IST a Úprava VOD čistého výkonu za celý rok.',
  },
};

const defaultChartMonthFilters: Record<ChartMonthFilterKey, ChartFilterDefinition> = {
  all: { label: 'Všetky', suffix: 'Zobrazené sú všetky mesiace obchodného roka.' },
  q1: { label: 'Q1', suffix: 'Zobrazený je 1. kvartál obchodného roka: marec až máj.' },
  q2: { label: 'Q2', suffix: 'Zobrazený je 2. kvartál obchodného roka: jún až august.' },
  q3: { label: 'Q3', suffix: 'Zobrazený je 3. kvartál obchodného roka: september až november.' },
  q4: { label: 'Q4', suffix: 'Zobrazený je 4. kvartál obchodného roka: december až február.' },
  open: { label: 'Otvorené', suffix: 'Zobrazené sú len otvorené mesiace.' },
  closed: { label: 'Uzavreté', suffix: 'Zobrazené sú len uzavreté mesiace.' },
};

function normalizeMetricName(value: string) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseChartMonthLabel(label: string) {
  const parts = String(label || '').trim().split(/\s+/);
  if (parts.length < 2) {
    return null;
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

  const monthName = normalizeMetricName(parts[0]);
  const yearValue = Number(parts[1]);
  if (!Object.prototype.hasOwnProperty.call(monthMap, monthName) || !yearValue) {
    return null;
  }

  return new Date(yearValue, monthMap[monthName], 1);
}

function isChartMonthClosed(label: string) {
  const monthDate = parseChartMonthLabel(label);
  if (!monthDate) {
    return false;
  }

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return monthDate.getTime() < currentMonthStart.getTime();
}

function getChartQuarterKey(label: string) {
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

function getMonthIndexesByFilter(labels: string[], filterMode: ChartMonthFilterKey) {
  const indexes = labels.reduce<number[]>((result, label, index) => {
    const isClosed = isChartMonthClosed(label);
    const quarterKey = getChartQuarterKey(label);
    if (filterMode === 'closed' && !isClosed) {
      return result;
    }
    if (filterMode === 'open' && isClosed) {
      return result;
    }
    if (/^q[1-4]$/.test(filterMode) && quarterKey !== filterMode) {
      return result;
    }
    result.push(index);
    return result;
  }, []);

  return indexes.length ? indexes : labels.map((_, index) => index);
}

function pickValuesByIndexes<T>(values: T[], indexes: number[]) {
  return indexes.map((index) => values[index]);
}

function filterChartSeriesByMonth(
  labels: string[],
  dataSeries: Record<string, Array<number | boolean>>,
  filterMode: ChartMonthFilterKey,
) {
  const visibleIndexes = getMonthIndexesByFilter(labels, filterMode);
  const filtered: Record<string, Array<number | boolean> | string[]> = {
    labels: pickValuesByIndexes(labels, visibleIndexes),
  };

  Object.keys(dataSeries).forEach((key) => {
    filtered[key] = pickValuesByIndexes(dataSeries[key] || [], visibleIndexes);
  });

  return filtered;
}

function formatMonthShort(label: string) {
  const value = String(label || '').trim();
  const parts = value.split(/\s+/);
  if (parts.length < 2) {
    return value;
  }

  const map: Record<string, string> = {
    januar: 'Jan',
    'január': 'Jan',
    februar: 'Feb',
    'február': 'Feb',
    marec: 'Mar',
    april: 'Apr',
    'apríl': 'Apr',
    maj: 'May',
    jun: 'Jun',
    'jún': 'Jun',
    jul: 'Jul',
    'júl': 'Jul',
    august: 'Aug',
    september: 'Sep',
    oktober: 'Oct',
    'október': 'Oct',
    november: 'Nov',
    december: 'Dec',
  };

  return `${map[normalizeMetricName(parts[0])] || parts[0]} ${parts[1]}`;
}

function getThemeColor(variableName: string, fallback: string) {
  if (typeof window === 'undefined') {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  return value || fallback;
}

function formatMetric(value: number, format: MetricFormat) {
  const raw = Number(value || 0);
  if (format === 'currency') {
    return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(raw);
  }
  if (format === 'hours') {
    return `${new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 1 }).format(raw)} h`;
  }
  return new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 1 }).format(raw);
}

function shortMetric(value: number, format: MetricFormat) {
  const raw = Number(value || 0);
  if (format === 'currency') {
    const absolute = Math.abs(raw);
    if (absolute >= 999500) {
      return `${new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 1 }).format(raw / 1000000)} M€`;
    }
    if (absolute >= 1000) {
      return `${new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 1 }).format(raw / 1000)} k€`;
    }
    return formatMetric(raw, 'currency');
  }
  if (format === 'hours') {
    return `${new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 1 }).format(raw / 1000)}k`;
  }
  return new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 1 }).format(raw);
}

function getChartConfig(detail: ChartEventDetail) {
  const { charts, activeMode, activeMonthFilter } = detail;

  if (activeMode === 'hours') {
    const filtered = filterChartSeriesByMonth(charts.hours.labels, {
      plan: charts.hours.plan,
      forecast: charts.hours.forecast,
      real: charts.hours.real,
    }, activeMonthFilter);
    return {
      labels: (filtered.labels as string[]).map(formatMonthShort),
      format: 'hours' as MetricFormat,
      plan: filtered.plan as number[],
      forecast: filtered.forecast as number[],
      real: filtered.real as number[],
      forecastLabel: 'Úprava VOD Hodiny netto',
      realMuted: false,
    };
  }

  if (activeMode === 'workforce') {
    const filtered = filterChartSeriesByMonth(charts.workforce?.labels || [], {
      plan: charts.workforce?.plan || [],
      forecast: charts.workforce?.forecast || [],
      real: charts.workforce?.real || [],
      realFlags: charts.workforce?.realFlags || [],
    }, activeMonthFilter);
    const realFlags = (filtered.realFlags as boolean[]) || [];
    return {
      labels: (filtered.labels as string[]).map(formatMonthShort),
      format: 'hours' as MetricFormat,
      plan: filtered.plan as number[],
      forecast: filtered.forecast as number[],
      real: filtered.real as number[],
      forecastLabel: 'Aktuálna štruktúra hodín',
      realMuted: !realFlags.some(Boolean),
    };
  }

  if (activeMode === 'performance') {
    const filtered = filterChartSeriesByMonth(charts.performance.labels, {
      plan: charts.performance.plan,
      forecast: charts.performance.forecast,
      real: charts.performance.real,
    }, activeMonthFilter);
    return {
      labels: (filtered.labels as string[]).map(formatMonthShort),
      format: 'number' as MetricFormat,
      plan: filtered.plan as number[],
      forecast: filtered.forecast as number[],
      real: filtered.real as number[],
      forecastLabel: 'Úprava VOD Čistý výkon',
      realMuted: false,
    };
  }

  const filtered = filterChartSeriesByMonth(charts.obrat.labels, {
    plan: charts.obrat.plan,
    forecast: charts.obrat.forecast,
    real: charts.obrat.real,
  }, activeMonthFilter);
  return {
    labels: (filtered.labels as string[]).map(formatMonthShort),
    format: 'currency' as MetricFormat,
    plan: filtered.plan as number[],
    forecast: filtered.forecast as number[],
    real: filtered.real as number[],
    forecastLabel: 'Úprava VOD Obrat GJ2026',
    realMuted: false,
  };
}

export function IndexDashboardChartSection() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<{ destroy: () => void } | null>(null);
  const [chartState, setChartState] = useState<ChartState>(null);

  useEffect(() => {
    const handleChartEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ChartEventDetail>;
      setChartState(customEvent.detail);
    };

    window.addEventListener('pro-dashboard:render-charts', handleChartEvent as EventListener);
    return () => {
      window.removeEventListener('pro-dashboard:render-charts', handleChartEvent as EventListener);
    };
  }, []);

  const activeMode = chartState?.activeMode || 'obrat';
  const activeFilter = chartState?.activeMonthFilter || 'all';
  const chartModes = chartState?.chartModes || defaultChartModes;
  const chartMonthFilters = chartState?.chartMonthFilters || defaultChartMonthFilters;
  const activeChartMeta = chartModes[activeMode] || defaultChartModes.obrat;
  const collapsed = Boolean(chartState?.collapsed);

  const derivedConfig = useMemo(() => {
    if (!chartState) {
      return null;
    }
    return getChartConfig(chartState);
  }, [chartState]);

  useEffect(() => {
    if (!canvasRef.current || !derivedConfig || !window.Chart) {
      return;
    }

    chartRef.current?.destroy();

    const chart = new window.Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: derivedConfig.labels,
        datasets: [
          {
            label: 'Ročný Plán',
            data: derivedConfig.plan,
            borderColor: getThemeColor('--chart-plan', '#2563eb'),
            backgroundColor: getThemeColor('--chart-plan-soft', 'rgba(37, 99, 235, 0.18)'),
            valueFormat: derivedConfig.format,
            fill: true,
            tension: 0.28,
            borderWidth: 3,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: getThemeColor('--chart-plan', '#2563eb'),
            pointBorderWidth: 2,
            order: 1,
          },
          {
            label: derivedConfig.forecastLabel,
            data: derivedConfig.forecast,
            borderColor: getThemeColor('--chart-forecast', '#c0352b'),
            backgroundColor: getThemeColor('--chart-forecast-soft', 'rgba(192, 53, 43, 0.18)'),
            valueFormat: derivedConfig.format,
            fill: true,
            tension: 0.28,
            borderWidth: 3,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: getThemeColor('--chart-forecast', '#c0352b'),
            pointBorderWidth: 2,
            order: 2,
          },
          {
            label: 'IST',
            data: derivedConfig.real,
            borderColor: derivedConfig.realMuted ? getThemeColor('--muted', '#64748b') : getThemeColor('--chart-ist', '#111827'),
            backgroundColor: derivedConfig.realMuted ? 'rgba(100, 116, 139, 0.10)' : getThemeColor('--chart-ist-soft', 'rgba(17, 24, 39, 0.12)'),
            valueFormat: derivedConfig.format,
            fill: true,
            tension: 0.28,
            borderWidth: 3,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: derivedConfig.realMuted ? '#f8fafc' : '#ffffff',
            pointBorderColor: derivedConfig.realMuted ? getThemeColor('--muted', '#64748b') : getThemeColor('--chart-ist', '#111827'),
            pointBorderWidth: 2,
            borderDash: derivedConfig.realMuted ? [6, 4] : undefined,
            order: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: getThemeColor('--chart-legend-text', '#4b5563'),
              usePointStyle: true,
              boxWidth: 8,
              font: { family: 'IBM Plex Sans', weight: '600' },
            },
          },
          tooltip: {
            backgroundColor: getThemeColor('--tooltip-bg', 'rgba(19, 35, 52, 0.94)'),
            titleFont: { family: 'IBM Plex Sans', weight: '700' },
            bodyFont: { family: 'IBM Plex Sans', weight: '500' },
            displayColors: true,
            callbacks: {
              label(context: { dataset: { label: string; valueFormat: MetricFormat }; raw: number }) {
                return `${context.dataset.label}: ${formatMetric(context.raw, context.dataset.valueFormat)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: getThemeColor('--muted', '#475569'), font: { family: 'IBM Plex Sans', weight: '600' } },
          },
          y: {
            grid: { color: getThemeColor('--grid', 'rgba(15, 23, 42, 0.10)') },
            ticks: {
              color: getThemeColor('--muted', '#475569'),
              callback(value: number) {
                return shortMetric(value, derivedConfig.format);
              },
              font: { family: 'IBM Plex Sans', weight: '600' },
            },
          },
        },
      },
    });

    chartRef.current = chart;
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, [derivedConfig]);

  return (
    <section className={`chart-panel chart-mode-panel${collapsed ? ' is-collapsed' : ''}`} id="mainChartPanel">
      <div className="chart-mode-head">
        <div className="chart-mode-copy">
          <div className="panel-title">Ročný prehľad ukazovateľov</div>
          <div className="overview-title" id="chartModeTitle">{activeChartMeta.title}</div>
          <div className="support-text" id="chartModeSubtitle">{`${activeChartMeta.subtitle} ${chartMonthFilters[activeFilter].suffix}`}</div>
        </div>
        <div className="chart-control-stack">
          <button className="secondary-btn chart-collapse-button" id="chartCollapseButton" type="button" aria-controls="mainChartWrap" aria-expanded={collapsed ? 'false' : 'true'}>
            {collapsed ? 'Rozbaliť graf' : 'Zbaliť graf'}
          </button>
          <div className="chart-control-group">
            <div className="field-label chart-control-label">Režim grafu</div>
            <div className="chart-mode-tabs" id="chartModeControls">
              {Object.entries(chartModes).map(([modeKey, mode]) => (
                <button
                  className={modeKey === activeMode ? 'chart-mode-button is-active' : 'chart-mode-button'}
                  data-chart-mode={modeKey}
                  key={modeKey}
                  type="button"
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-control-group">
            <div className="field-label chart-control-label">Výrez grafu</div>
            <div className="chart-mode-tabs" id="chartMonthFilterControls">
              {Object.entries(chartMonthFilters).map(([filterKey, filter]) => (
                <button
                  className={filterKey === activeFilter ? 'chart-mode-button chart-mode-button--subtle is-active' : 'chart-mode-button chart-mode-button--subtle'}
                  data-chart-month-filter={filterKey}
                  key={filterKey}
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="chart-wrap chart-wrap--xl" id="mainChartWrap" style={{ display: collapsed ? 'none' : undefined }}>
        <canvas id="unifiedChart" ref={canvasRef} />
      </div>
    </section>
  );
}