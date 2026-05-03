'use client';

import { useEffect, useRef, useState } from 'react';

import styles from './legacy-dashboard-host.module.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

type LegacyAsset = 'index' | 'sumar' | 'test';
type BodyMode = 'full' | 'scripts-only';

function isHeadAssetElement(node: Element) {
  const tagName = node.tagName.toLowerCase();
  return tagName === 'style' || tagName === 'link' || tagName === 'meta' || tagName === 'script' || tagName === 'title';
}

function getAssetKey(node: Element) {
  const tagName = node.tagName.toLowerCase();
  if (tagName === 'script') {
    return `script:${node.getAttribute('src') || node.textContent || ''}`;
  }
  if (tagName === 'link') {
    return `link:${node.getAttribute('href') || ''}:${node.getAttribute('rel') || ''}`;
  }
  if (tagName === 'style') {
    return `style:${node.textContent || ''}`;
  }
  if (tagName === 'meta') {
    return `meta:${node.getAttribute('name') || node.getAttribute('property') || ''}:${node.getAttribute('content') || ''}`;
  }
  if (tagName === 'title') {
    return `title:${node.textContent || ''}`;
  }
  return `${tagName}:${node.outerHTML}`;
}

function cloneAttributes(source: Element, target: Element) {
  Array.from(source.attributes).forEach((attribute) => {
    target.setAttribute(attribute.name, attribute.value);
  });
}

function buildWrappedInlineScript(scriptContent: string) {
  return `(() => {\n${scriptContent}\nif (typeof openTestLabView === 'function') { window.openTestLabView = openTestLabView; }\nif (typeof openSummaryView === 'function') { window.openSummaryView = openSummaryView; }\n})();`;
}

function patchIndexInlineScript(scriptContent: string) {
  const patchedScript = scriptContent.replace(
    /function renderCharts\(payload\) \{[\s\S]*?renderOrUpdateChart\('unifiedChart', buildLargeChartConfig\(activeMode, activeMonthFilter, charts\)\);\s*\}/,
    `function renderCharts(payload) {
        if (!payload || !Array.isArray(payload.months) || !payload.months.length) {
          return;
        }
        updateChartPanelState();
        window.dispatchEvent(new CustomEvent('pro-dashboard:render-charts', {
          detail: {
            payload: payload,
            charts: buildChartsFromPayload(payload),
            activeMode: getActiveChartMode(),
            activeMonthFilter: getActiveChartMonthFilter(),
            collapsed: Boolean(state.selectedChartCollapsed),
            chartModes: CHART_MODES,
            chartMonthFilters: CHART_MONTH_FILTERS,
          }
        }));
      }`,
  );

  return `${patchedScript}

;(function() {
  function buildMonthlyMetricTableDetail(payload) {
    var canEdit = payload && payload.user && payload.user.role === 'VOD' && payload.scope && payload.scope.type === 'STORE';
    var workingDaysByMonth = resolveWorkingDaysForStructure(payload.table, payload.months);
    var focusedMonth = getFocusedMonthForCompactTables(payload.months);
    var visibleMonthEntries = getVisibleMonthEntries(payload.months);
    var filteredSections = getFilteredMetricSections(payload);

    return {
      focusedMonth: focusedMonth,
      canEdit: Boolean(canEdit),
      visibleMonthEntries: visibleMonthEntries,
      structureCompareMode: typeof getStructureMixCompareMode === 'function' ? getStructureMixCompareMode() : 'none',
      scopeId: payload && payload.scope ? String(payload.scope.id || '') : '',
      role: payload && payload.user ? String(payload.user.role || '') : '',
      sections: filteredSections.map(function(section) {
        var sectionPlanRow = section.rows.find(function(row) { return row.type === 'plan'; }) || { values: [], total: 0 };
        var sectionRealRow = section.rows.find(function(row) { return row.type === 'real'; }) || null;
        var sectionAdjustmentRow = section.rows.find(function(row) { return row.type === 'adjustment'; }) || { closed: [] };
        var usesForecastInput = canEdit && usesUnifiedForecastInput(section);
        var displayRows = filterVisibleDisplayRows(buildDisplayRowsForSection(section, payload.months, workingDaysByMonth, {
          scopeType: payload.scope && payload.scope.type,
          table: payload.table,
        }));
        var compactMonthsLabel = visibleMonthEntries.length !== payload.months.length
          ? 'Zobrazené mesiace: ' + visibleMonthEntries.map(function(entry) { return formatMonthShort(entry.month); }).join(' • ')
          : '';
        var headerMeta = [compactMonthsLabel, section.breakdown && section.breakdown.length ? 'VKL/GF drill-down po filiálkach' : ''].filter(Boolean).join(' • ');

        if (typeof ensureMetricNotesLoaded === 'function') {
          ensureMetricNotesLoaded(section.metric);
        }
        var cachedNotes = typeof getCachedMetricNotes === 'function' ? getCachedMetricNotes(section.metric) : null;
        var vodNoteRaw = cachedNotes && cachedNotes.VOD ? cachedNotes.VOD : null;
        var vodNote = vodNoteRaw && String(vodNoteRaw.text || '').trim()
          ? { text: String(vodNoteRaw.text || '').trim(), author: vodNoteRaw.author || '', updatedAt: vodNoteRaw.updatedAt || '' }
          : null;

        return {
          metric: section.metric,
          title: getMetricDisplayLabel(section.metric),
          format: section.format,
          collapsed: isMetricCollapsed(section.metric),
          headerMeta: headerMeta,
          usesForecastInput: usesForecastInput,
          rows: displayRows.map(function(row) {
            return Object.assign({}, row, { displayLabel: getDisplayRowLabel(row) });
          }),
          planValues: Array.isArray(sectionPlanRow.values) ? sectionPlanRow.values.map(function(value) { return Number(value || 0); }) : [],
          planTotal: Number(sectionPlanRow.total || 0),
          realRow: sectionRealRow,
          adjustmentClosed: Array.isArray(sectionAdjustmentRow.closed) ? sectionAdjustmentRow.closed.slice() : [],
          workingDaysByMonth: workingDaysByMonth,
          breakdownHtml: typeof renderBreakdownBlock === 'function' ? renderBreakdownBlock(section, payload.months, visibleMonthEntries, workingDaysByMonth) : '',
          vodNote: vodNote,
        };
      }),
    };
  }

  if (typeof renderMetricTable === 'function') {
    var originalRenderMetricTable = renderMetricTable;
    renderMetricTable = function(payload) {
      if (getActiveTableView() === 'weekly') {
        window.dispatchEvent(new CustomEvent('pro-dashboard:use-legacy-table'));
        return originalRenderMetricTable(payload);
      }

      renderMetricTableHeading(payload);
      setMetricCollapseControlsVisibility(true);
      renderMetricCollapseControls(payload);
      window.dispatchEvent(new CustomEvent('pro-dashboard:render-monthly-table', {
        detail: buildMonthlyMetricTableDetail(payload)
      }));
    };
  }

  if (typeof refreshLocalPreview === 'function') {
    window.applyReactForecastAdjustment = function(metric, month, value) {
      if (!state.pendingAdjustments[metric]) {
        state.pendingAdjustments[metric] = {};
      }
      state.pendingAdjustments[metric][month] = Number(value || 0);
      if (typeof removePendingWeeklyAdjustmentValues === 'function') {
        removePendingWeeklyAdjustmentValues(metric, month);
      }
      refreshLocalPreview();
    };

    window.applyReactStructureMixAdjustment = function(month, bands, baselineTotalAdjustment, baselineDailyHours, workingDays) {
      (bands || []).forEach(function(band) {
        if (!state.pendingAdjustments[band.key]) {
          state.pendingAdjustments[band.key] = {};
        }
        state.pendingAdjustments[band.key][month] = Number(band.count || 0);
      });

      var currentFte = (bands || []).reduce(function(sum, band) {
        return sum + (Number(band.count || 0) * Number(band.fteWeight || 0));
      }, 0);
      var currentDailyHours = (bands || []).reduce(function(sum, band) {
        return sum + (Number(band.count || 0) * Number(band.hoursWeight || 0));
      }, 0);

      if (!state.pendingAdjustments['Štruktúra filiálky (plné úväzky)']) {
        state.pendingAdjustments['Štruktúra filiálky (plné úväzky)'] = {};
      }
      state.pendingAdjustments['Štruktúra filiálky (plné úväzky)'][month] = Math.round((currentFte - Number(baselineTotalAdjustment || 0)) * 100) / 100;
      refreshLocalPreview();
    };
  }

  if (typeof toggleMetricCollapsed === 'function') {
    window.toggleMetricCollapsed = toggleMetricCollapsed;
  }

  if (typeof setStructureMixCompareMode === 'function') {
    window.setStructureMixCompareMode = setStructureMixCompareMode;
  }

  window.addEventListener('pro-dashboard:metric-notes-loaded', function() {
    if (state && state.dashboard && typeof renderMetricTable === 'function' && (typeof getActiveTableView !== 'function' || getActiveTableView() !== 'weekly')) {
      renderMetricTable(state.dashboard);
    }
  });
})();`;
}

function appendScript(
  targetParent: HTMLElement | HTMLHeadElement,
  sourceScript: HTMLScriptElement,
  options?: { wrapInline?: boolean; patchInline?: (script: string) => string },
) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    cloneAttributes(sourceScript, script);
    script.dataset.legacyDashboardInjected = 'true';

    if (sourceScript.src) {
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Script load failed: ${sourceScript.src}`));
      script.src = sourceScript.src;
    } else {
      const patchedContent = options?.patchInline ? options.patchInline(sourceScript.textContent || '') : (sourceScript.textContent || '');
      script.textContent = options?.wrapInline
        ? buildWrappedInlineScript(patchedContent)
        : patchedContent;
      resolve();
    }

    targetParent.appendChild(script);
  });
}

async function injectHeadAssets(parsedDocument: Document) {
  const injectedNodes: HTMLElement[] = [];

  for (const node of Array.from(parsedDocument.head.children)) {
    if (!isHeadAssetElement(node)) {
      continue;
    }

    const tagName = node.tagName.toLowerCase();
    if (tagName === 'title') {
      document.title = node.textContent || document.title;
      continue;
    }

    const assetKey = getAssetKey(node);
    const existing = document.head.querySelector(`[data-legacy-dashboard-asset-key="${CSS.escape(assetKey)}"]`);
    if (existing) {
      continue;
    }

    if (tagName === 'script') {
      await appendScript(document.head, node as HTMLScriptElement);
      const appendedScript = document.head.lastElementChild as HTMLElement | null;
      if (appendedScript) {
        appendedScript.dataset.legacyDashboardAssetKey = assetKey;
        injectedNodes.push(appendedScript);
      }
      continue;
    }

    const clone = node.cloneNode(true) as HTMLElement;
    clone.dataset.legacyDashboardInjected = 'true';
    clone.dataset.legacyDashboardAssetKey = assetKey;
    document.head.appendChild(clone);
    injectedNodes.push(clone);
  }

  return injectedNodes;
}

async function injectBody(parsedDocument: Document, target: HTMLDivElement, bodyMode: BodyMode, asset: LegacyAsset) {
  const bodyScripts: HTMLScriptElement[] = [];

  Array.from(parsedDocument.body.childNodes).forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toLowerCase() === 'script') {
      bodyScripts.push(node as HTMLScriptElement);
      return;
    }

    if (bodyMode === 'scripts-only') {
      return;
    }

    target.appendChild(node.cloneNode(true));
  });

  for (const scriptNode of bodyScripts) {
    await appendScript(target, scriptNode, {
      wrapInline: !scriptNode.src,
      patchInline: asset === 'index' ? patchIndexInlineScript : undefined,
    });
  }
}

export function LegacyDashboardHost({ asset, bodyMode = 'full' }: { asset: LegacyAsset; bodyMode?: BodyMode }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let disposed = false;
    setLoadState({ status: 'loading' });

    const load = async () => {
      const host = hostRef.current;
      if (!host) {
        return;
      }

      document.body.classList.add('legacy-dashboard-page');

      try {
        const response = await fetch(`/legacy-index?asset=${asset}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Legacy dashboard load failed with status ${response.status}.`);
        }

        const html = await response.text();
        if (disposed) {
          return;
        }

        const parser = new DOMParser();
        const parsedDocument = parser.parseFromString(html, 'text/html');
        const injectedHeadNodes = await injectHeadAssets(parsedDocument);
        if (disposed) {
          injectedHeadNodes.forEach((node) => node.remove());
          return;
        }

        host.replaceChildren();
        await injectBody(parsedDocument, host, bodyMode, asset);
        if (disposed) {
          injectedHeadNodes.forEach((node) => node.remove());
          host.replaceChildren();
          return;
        }

        cleanupRef.current = () => {
          injectedHeadNodes.forEach((node) => node.remove());
          host.replaceChildren();
          document.body.classList.remove('legacy-dashboard-page');
        };

        setLoadState({ status: 'ready' });
      } catch (error) {
        document.body.classList.remove('legacy-dashboard-page');
        setLoadState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Legacy dashboard sa nepodarilo nacitat.',
        });
      }
    };

    void load();

    return () => {
      disposed = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [asset, bodyMode]);

  if (bodyMode === 'scripts-only') {
    return <div ref={hostRef} style={{ display: 'none' }} aria-hidden="true" />;
  }

  if (loadState.status === 'error') {
    return (
      <main className={styles.loading}>
        <section className={styles.errorCard}>
          <span className={styles.errorKicker}>Legacy TSX host</span>
          <h1 className={styles.errorTitle}>Dashboard sa nepodarilo inicializovat.</h1>
          <p className={styles.errorText}>{loadState.message}</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      {loadState.status === 'loading' ? (
        <section className={styles.loading}>
          <div className={styles.loadingCard}>
            <span className={styles.loadingKicker}>Legacy TSX host</span>
            <h1 className={styles.loadingTitle}>Nacitavam povodny dashboard bez iframe.</h1>
            <p className={styles.loadingText}>
              React stranka prebera legacy HTML, styly a skripty do jedneho runtime povrchu, aby dashboard bezal priamo v TSX route.
            </p>
          </div>
        </section>
      ) : null}
      <div className={styles.host} hidden={loadState.status !== 'ready'} ref={hostRef} />
    </main>
  );
}