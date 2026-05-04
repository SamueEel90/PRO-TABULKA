'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';

import type { MetricFormat, MetricRow, WorkforceStructureMixValue } from '@/lib/legacy/contracts';
import { applyLayout, loadLayout, subscribeLayout, type MetricLayout } from '@/lib/metric-layout';
import { NoteThread } from './note-thread';
import { ActivityFeed } from './activity-feed';
import { TaskCounter } from './task-counter';

type VisibleMonthEntry = {
  month: string;
  index: number;
};

type MonthlyTableRowModel = MetricRow & {
  displayLabel: string;
};

type MonthlyTableSectionModel = {
  metric: string;
  title: string;
  format: MetricFormat;
  collapsed: boolean;
  headerMeta: string;
  usesForecastInput: boolean;
  rows: MonthlyTableRowModel[];
  planValues: number[];
  planTotal: number;
  realRow?: MetricRow | null;
  adjustmentClosed: boolean[];
  workingDaysByMonth: Array<number | null>;
  breakdownHtml?: string;
  vodNote?: { text: string; author?: string; updatedAt?: string } | null;
};

type MonthlyTableRenderDetail = {
  focusedMonth: string;
  canEdit: boolean;
  visibleMonthEntries: VisibleMonthEntry[];
  structureCompareMode?: string;
  scopeId?: string;
  scopeType?: string;
  noteScopeKey?: string;
  vklName?: string;
  role?: string;
  userName?: string;
  sections: MonthlyTableSectionModel[];
};

type StructureBandInput = {
  key: string;
  label: string;
  count: number;
  planCount?: number;
  realCount?: number;
  hasRealCount?: boolean;
  fteWeight: number;
  hoursWeight: number;
};

declare global {
  interface Window {
    applyReactForecastAdjustment?: (metric: string, month: string, value: number) => void;
    applyReactStructureMixAdjustment?: (
      month: string,
      bands: StructureBandInput[],
      baselineTotalAdjustment: number,
      baselineDailyHours: number,
      workingDays: number,
    ) => void;
    toggleMetricCollapsed?: (metric: string) => void;
    setStructureMixCompareMode?: (mode: string) => void;
  }
}

const numberFormatter = new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 1 });
const currencyFormatter = new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

function normalizeMetricName(value: string) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isWorkforceStructureMetric(metric: string) {
  return normalizeMetricName(metric) === normalizeMetricName('Štruktúra filiálky (plné úväzky)');
}

function formatMetric(value: number | string | null | undefined, format: MetricFormat) {
  const raw = Number(value || 0);
  if (format === 'currency') {
    return currencyFormatter.format(raw);
  }
  if (format === 'hours') {
    return `${numberFormatter.format(raw)} h`;
  }
  return numberFormatter.format(raw);
}

function formatSignedMetric(value: number | string | null | undefined, format: MetricFormat) {
  const numericValue = Number(value || 0);
  if (numericValue > 0) {
    return `+${formatMetric(numericValue, format)}`;
  }
  return formatMetric(numericValue, format);
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

function getDeltaCellClass(value: number | string | null | undefined) {
  const numericValue = Number(value || 0);
  if (numericValue > 0) {
    return 'delta-positive';
  }
  if (numericValue < 0) {
    return 'delta-negative';
  }
  return 'delta-neutral';
}

function getForecastCellClass(forecastValue: number | string | null | undefined, planValue: number | string | null | undefined) {
  const forecast = Number(forecastValue || 0);
  const plan = Number(planValue || 0);
  if (forecast < plan) {
    return 'forecast-negative';
  }
  if (forecast > plan) {
    return 'forecast-positive';
  }
  return 'forecast-neutral';
}

function hasActualRealValue(row: MetricRow | null | undefined, index: number) {
  if (!row) {
    return false;
  }

  if (Array.isArray(row.hasRealFlags)) {
    return Boolean(row.hasRealFlags[index]);
  }

  const value = row.values[index];
  return typeof value === 'number' && Math.abs(Number(value || 0)) > 0.0001;
}

function getActualRealValue(row: MetricRow | null | undefined, index: number) {
  if (!row) {
    return 0;
  }

  if (Array.isArray(row.actualValues)) {
    return Number(row.actualValues[index] || 0);
  }

  const value = row.values[index];
  return typeof value === 'number' ? Number(value || 0) : 0;
}

function shouldUsePlanFallbackForMetric(metric: string) {
  const fallbackMetrics = [
    'Dlhodobá neprítomnosť (33+ dní) (b)',
    'Externá pracovná agentúra (+) Reinigung',
    'Externá pracovná agentúra (+) Wareneinräumung',
    'PN Krátkodobé',
    'Odmena za dohodu',
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

  return fallbackMetrics.some((fallbackMetric) => normalizeMetricName(fallbackMetric) === normalizeMetricName(metric));
}

function getPlanValueForIndex(section: MonthlyTableSectionModel, index: number) {
  return Number(section.planValues[index] || 0);
}

function getDisplayedRealValue(section: MonthlyTableSectionModel, row: MetricRow | null | undefined, index: number) {
  if (!row || index < 0) {
    return 0;
  }

  if (shouldUsePlanFallbackForMetric(section.metric) && !hasActualRealValue(row, index)) {
    return getPlanValueForIndex(section, index);
  }

  const rawValue = row.values[index];
  if (typeof rawValue === 'number' && (hasActualRealValue(row, index) || Math.abs(rawValue) > 0.0001)) {
    return rawValue;
  }

  return getPlanValueForIndex(section, index);
}

function isFallbackRealDisplay(section: MonthlyTableSectionModel, row: MetricRow | null | undefined, index: number) {
  if (!row || index < 0) {
    return false;
  }

  return shouldUsePlanFallbackForMetric(section.metric) && !hasActualRealValue(row, index) && Math.abs(getDisplayedRealValue(section, row, index)) > 0.0001;
}

function hasFallbackRealDisplay(section: MonthlyTableSectionModel, row: MetricRow | null | undefined) {
  if (!row) {
    return false;
  }

  return row.values.some((value, index) => typeof value === 'number' && isFallbackRealDisplay(section, row, index));
}

function isStructureMixValue(value: MetricRow['values'][number]): value is WorkforceStructureMixValue {
  return Boolean(value && typeof value === 'object' && 'bands' in value && Array.isArray(value.bands));
}

function formatStructureBandLabel(band: StructureBandInput) {
  const weight = Number(band.hoursWeight || 0);
  return weight.toFixed(2);
}

function StructureMixCell({
  mix,
  month,
  workingDays,
  editable,
  compareMode,
}: {
  mix: WorkforceStructureMixValue;
  month: string;
  workingDays: number;
  editable: boolean;
  compareMode?: string;
}) {
  const [bands, setBands] = useState<StructureBandInput[]>(() => mix.bands.map((band) => ({
    key: band.key,
    label: band.label,
    count: Number(band.count || 0),
    planCount: band.planCount,
    realCount: band.realCount,
    hasRealCount: band.hasRealCount,
    fteWeight: Number(band.fteWeight || 0),
    hoursWeight: Number(band.hoursWeight || 0),
  })));

  useEffect(() => {
    setBands(mix.bands.map((band) => ({
      key: band.key,
      label: band.label,
      count: Number(band.count || 0),
      planCount: band.planCount,
      realCount: band.realCount,
      hasRealCount: band.hasRealCount,
      fteWeight: Number(band.fteWeight || 0),
      hoursWeight: Number(band.hoursWeight || 0),
    })));
  }, [mix]);

  const baselineDailyHours = mix.bands.reduce((sum, band) => sum + (Number(band.count || 0) * Number(band.hoursWeight || 0)), 0);
  const currentTotal = bands.reduce((sum, band) => sum + (Number(band.count || 0) * Number(band.fteWeight || 0)), 0);

  return (
    <td className="structure-mix-cell" data-month={month}>
      <div className="structure-mix-month">{formatMonthShort(month)}</div>
      <div className="structure-mix-grid">
        {bands.map((band, bandIndex) => {
          const planDelta = Number(band.count || 0) - Number(band.planCount || 0);
          const realDelta = Number(band.count || 0) - Number(band.realCount || 0);

          return (
            <label className="structure-mix-item" key={`${month}-${band.key}`}> 
              <span>{formatStructureBandLabel(band)}</span>
              <input
                className="structure-mix-input"
                disabled={!editable}
                inputMode="numeric"
                min="0"
                step="1"
                type="number"
                value={band.count}
                onChange={(event) => {
                  const nextValue = Number(event.currentTarget.value || 0);
                  const nextBands = bands.map((currentBand, currentIndex) => currentIndex === bandIndex
                    ? { ...currentBand, count: nextValue }
                    : currentBand);
                  setBands(nextBands);
                  window.applyReactStructureMixAdjustment?.(month, nextBands, Number(mix.totalAdjustment || 0), baselineDailyHours, Number(workingDays || 0));
                }}
              />
              <div className="structure-mix-compare">
                {(compareMode === 'plan' || compareMode === 'both') ? (
                  <span className={`structure-compare-chip structure-compare-chip--plan${planDelta > 0 ? ' positive' : planDelta < 0 ? ' negative' : ''}`}>
                    {`Pl\u00e1n ${formatSignedMetric(planDelta, 'number')}`}
                  </span>
                ) : null}
                {(compareMode === 'ist' || compareMode === 'both') ? (
                  band.hasRealCount ? (
                    <span className={`structure-compare-chip structure-compare-chip--ist${realDelta > 0 ? ' positive' : realDelta < 0 ? ' negative' : ''}`}>
                      {`IST ${formatSignedMetric(realDelta, 'number')}`}
                    </span>
                  ) : (
                    <span className="structure-compare-chip structure-compare-chip--ist is-empty" title="IST e\u0161te nie je k dispoz\u00edcii">
                      IST {formatSignedMetric(0, 'number')}
                    </span>
                  )
                ) : null}
              </div>
            </label>
          );
        })}
      </div>
    </td>
  );
}

function renderYearTotalCell(section: MonthlyTableSectionModel, row: MonthlyTableRowModel) {
  if (row.type === 'structure-mix') {
    return <td className="year-total-cell delta-neutral">model</td>;
  }

  if (row.type === 'structure-days') {
    return <td className="year-total-cell">{formatMetric(row.total, row.displayFormat || 'fte')}</td>;
  }

  if (row.type === 'static-plan' || row.type === 'workforce-total' || row.type === 'structure-hours-derived' || row.type === 'structure-hours-plan') {
    return <td className="year-total-cell">{formatMetric(row.total, row.displayFormat || section.format)}</td>;
  }

  if (row.type === 'structure-hours-real') {
    const hasAnyRealValue = Array.isArray(row.hasRealFlags) && row.hasRealFlags.some(Boolean);
    if (!hasAnyRealValue) {
      return <td className="year-total-cell ist-zero-fill" title="IST ešte nie je k dispozícii">{formatMetric(0, row.displayFormat || 'hours')}</td>;
    }

    const isPartial = Array.isArray(row.hasRealFlags) && row.hasRealFlags.some((flag) => !flag);
    return <td className="year-total-cell" title={isPartial ? 'IST sumár obsahuje len dostupné mesiace' : undefined}>{formatMetric(row.total, row.displayFormat || 'hours')}</td>;
  }

  if (row.type === 'forecast' || row.type === 'recommendation-result') {
    return <td className={`year-total-cell ${getForecastCellClass(row.total, section.planTotal)}`}>{formatMetric(row.total, section.format)}</td>;
  }

  if (row.type === 'real') {
    const displayedTotal: number = normalizeMetricName(section.metric) === normalizeMetricName('Čistý výkon')
      ? Number(row.total || 0)
      : row.values.reduce<number>((sum, value, index) => sum + (typeof value === 'number' ? getDisplayedRealValue(section, row, index) : 0), 0);
    const highlight = hasFallbackRealDisplay(section, row) ? ' ist-plan-fill' : '';
    return <td className={`year-total-cell${highlight}`} title={highlight ? 'IST sumár obsahuje mesiace doplnené z plánu' : undefined}>{formatMetric(displayedTotal, section.format)}</td>;
  }

  if (row.type === 'recommendation' || row.type === 'delta') {
    return <td className={`year-total-cell ${getDeltaCellClass(row.total)}`}><span className="delta-value">{formatSignedMetric(row.total, section.format)}</span></td>;
  }

  return <td className="year-total-cell">{formatMetric(row.total, section.format)}</td>;
}

function renderCell(section: MonthlyTableSectionModel, row: MonthlyTableRowModel, entry: VisibleMonthEntry, canEdit: boolean, focusedMonth: string, compareMode?: string) {
  const value = row.values[entry.index];
  const month = entry.month;
  const focusedCellClass = month === focusedMonth ? 'metric-month-cell is-focused' : '';
  const format = row.displayFormat || section.format;

  if (row.type === 'structure-mix' && isStructureMixValue(value)) {
    return (
      <StructureMixCell
        compareMode={compareMode}
        editable={canEdit}
        mix={value}
        month={month}
        workingDays={Number(section.workingDaysByMonth[entry.index] || 0)}
      />
    );
  }

  if (row.type === 'structure-days') {
    return <td className={focusedCellClass}>{formatMetric(typeof value === 'number' ? value : 0, row.displayFormat || 'fte')}</td>;
  }

  if (row.type === 'static-plan' || row.type === 'workforce-total' || row.type === 'structure-hours-derived' || row.type === 'structure-hours-plan') {
    return <td className={focusedCellClass}>{formatMetric(typeof value === 'number' ? value : 0, format)}</td>;
  }

  if (row.type === 'structure-hours-real') {
    if (value == null) {
      return <td className={`${focusedCellClass} ist-zero-fill`} title="IST ešte nie je k dispozícii">{formatMetric(0, row.displayFormat || 'hours')}</td>;
    }
    return <td className={focusedCellClass}>{formatMetric(typeof value === 'number' ? value : 0, row.displayFormat || 'hours')}</td>;
  }

  if (row.type === 'delta' || row.type === 'recommendation') {
    return <td className={`${focusedCellClass} ${getDeltaCellClass(value as number)}`}><span className="delta-value">{formatSignedMetric(value as number, section.format)}</span></td>;
  }

  if (row.type === 'recommendation-result') {
    return <td className={`${focusedCellClass} ${getForecastCellClass(value as number, section.planValues[entry.index])}`}>{formatMetric(value as number, section.format)}</td>;
  }

  if (row.type === 'forecast') {
    if (section.usesForecastInput) {
      const disabled = hasActualRealValue(section.realRow, entry.index) || Boolean(section.adjustmentClosed[entry.index]);
      return (
        <td className={focusedCellClass}>
          <input
            className="editable-cell editable-forecast-cell"
            data-metric={section.metric}
            data-month={month}
            disabled={disabled}
            value={typeof value === 'number' ? value : 0}
            onChange={(event) => {
              window.applyReactForecastAdjustment?.(section.metric, month, Number(event.currentTarget.value || 0));
            }}
          />
        </td>
      );
    }

    return <td className={`${focusedCellClass} ${getForecastCellClass(value as number, section.planValues[entry.index])}`}>{formatMetric(value as number, section.format)}</td>;
  }

  if (row.type === 'real') {
    const displayedValue = getDisplayedRealValue(section, row, entry.index);
    const isPlanFallback = isFallbackRealDisplay(section, row, entry.index);
    return <td className={`${focusedCellClass}${isPlanFallback ? ' ist-plan-fill' : ''}`} title={isPlanFallback ? 'IST je zatiaľ doplnené z plánu' : undefined}>{formatMetric(displayedValue, section.format)}</td>;
  }

  return <td className={focusedCellClass}>{formatMetric(typeof value === 'number' ? value : 0, section.format)}</td>;
}

export function IndexDashboardMonthlyTable() {
  const [detail, setDetail] = useState<MonthlyTableRenderDetail | null>(null);
  const [layout, setLayout] = useState<MetricLayout>({ order: [], hidden: [] });

  useEffect(() => {
    const handleRender = (event: Event) => {
      const customEvent = event as CustomEvent<MonthlyTableRenderDetail>;
      setDetail(customEvent.detail);
    };

    const handleUseLegacy = () => {
      setDetail(null);
    };

    window.addEventListener('pro-dashboard:render-monthly-table', handleRender as EventListener);
    window.addEventListener('pro-dashboard:use-legacy-table', handleUseLegacy);
    return () => {
      window.removeEventListener('pro-dashboard:render-monthly-table', handleRender as EventListener);
      window.removeEventListener('pro-dashboard:use-legacy-table', handleUseLegacy);
    };
  }, []);

  const scopeId = String(detail?.scopeId || '');
  const scopeType = String(detail?.scopeType || '');
  const noteScopeKey = String(detail?.noteScopeKey || '');
  const vklName = String(detail?.vklName || '');
  const role = String(detail?.role || '');
  const userName = String(detail?.userName || role);

  // For STORE scope, also fetch broadcast comments from VKL level
  const broadcastScopeKey = scopeType === 'STORE' && vklName ? `AGGREGATE|VKL|${vklName}` : '';

  useEffect(() => {
    if (!scopeId || !role) {
      setLayout({ order: [], hidden: [] });
      return;
    }
    setLayout(loadLayout(scopeId, role));
    const unsubscribe = subscribeLayout(scopeId, role, () => {
      setLayout(loadLayout(scopeId, role));
    });
    return unsubscribe;
  }, [scopeId, role]);

  const orderedSections = useMemo(() => {
    if (!detail) {
      return [];
    }
    return applyLayout(detail.sections, layout);
  }, [detail, layout]);

  return (
    <>
      {detail && noteScopeKey ? (
        <div className="activity-feed-bar">
          <TaskCounter
            scopeKey={noteScopeKey}
            broadcastScopeKey={broadcastScopeKey}
            currentRole={role}
            currentAuthor={userName}
          />
          <ActivityFeed scopeKey={noteScopeKey} userId={`${scopeId}:${role}`} />
        </div>
      ) : null}
      <div id="metricTableReactRoot" hidden={!detail}>
        {detail ? orderedSections.map((section) => {
          const toggleLabel = section.collapsed ? 'Rozbaliť' : 'Zbaliť';

          return (
            <section className={`metric-section${section.collapsed ? ' is-collapsed' : ''}`} key={section.metric}>
              <div className="metric-heading">
                <div className="metric-header-row">
                  <div className="metric-title-stack">
                    <div className="metric-title-group">
                      <span>{section.title}</span>
                      <NoteThread
                        scopeKey={noteScopeKey}
                        broadcastScopeKey={broadcastScopeKey}
                        metricKey={section.metric}
                        metricTitle={section.title}
                        currentRole={role}
                        currentAuthor={userName}
                        legacyNote={section.vodNote}
                      />
                    </div>
                    {section.headerMeta ? <span className="tiny">{section.headerMeta}</span> : null}
                  </div>
                  <div className="metric-actions">
                    <button
                      aria-expanded={section.collapsed ? 'false' : 'true'}
                      className="metric-toggle"
                      data-toggle-metric={section.metric}
                      type="button"
                      onClick={() => {
                        window.toggleMetricCollapsed?.(section.metric);
                      }}
                    >
                      {toggleLabel}
                    </button>
                  </div>
                </div>
                {isWorkforceStructureMetric(section.metric) ? (
                  <div className="structure-compare-toggle">
                    <span className="structure-compare-toggle-label">Porovnanie</span>
                    {([
                      { key: 'none', label: 'VOD' },
                      { key: 'plan', label: 'vs PLÁN' },
                      { key: 'ist', label: 'vs IST' },
                      { key: 'both', label: 'vs IST a PLÁN' },
                    ] as const).map((mode) => (
                      <button
                        className={`structure-compare-button${(detail.structureCompareMode || 'both') === mode.key ? ' is-active' : ''}`}
                        key={mode.key}
                        type="button"
                        onClick={() => window.setStructureMixCompareMode?.(mode.key)}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="metric-section-body">
                <div className="metric-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Obdobie</th>
                        {detail.visibleMonthEntries.map((entry) => (
                          <th className={`metric-month-head${entry.month === detail.focusedMonth ? ' is-focused' : ''}`} key={`${section.metric}-${entry.month}`}>
                            {formatMonthShort(entry.month)}
                          </th>
                        ))}
                        <th>Sumár roka</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.length ? section.rows.map((row) => (
                        <tr data-row-type={row.type} key={`${section.metric}-${row.type}-${row.displayLabel}`}>
                          <td>{row.displayLabel}</td>
                          {detail.visibleMonthEntries.map((entry) => (
                            <Fragment key={`${section.metric}-${row.type}-${entry.month}`}>
                              {renderCell(section, row, entry, detail.canEdit, detail.focusedMonth, detail.structureCompareMode)}
                            </Fragment>
                          ))}
                          {renderYearTotalCell(section, row)}
                        </tr>
                      )) : (
                        <tr className="rows-hidden-placeholder">
                          <td colSpan={detail.visibleMonthEntries.length + 2}>Vybrané vrstvy sú skryté.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {section.breakdownHtml ? (
                // Pre-rendered breakdown HTML from the legacy renderer (already HTML-escaped internaly)
                // eslint-disable-next-line react/no-danger
                <div dangerouslySetInnerHTML={{ __html: section.breakdownHtml }} />
              ) : null}
            </section>
          );
        }) : null}
      </div>
      <div id="metricTableContainer" hidden={Boolean(detail)} />
    </>
  );
}