'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { applyLayout, loadLayout, resetLayout, saveLayout, subscribeLayout, type MetricLayout } from '@/lib/metric-layout';

type MetricEntry = {
  metric: string;
  title: string;
};

type LayoutSourceDetail = {
  scopeId?: string;
  role?: string;
  sections?: Array<{ metric: string; title: string }>;
};

export function MetricLayoutPanel() {
  const [scopeId, setScopeId] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [allMetrics, setAllMetrics] = useState<MetricEntry[]>([]);
  const [layout, setLayout] = useState<MetricLayout>({ order: [], hidden: [] });
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    const handleRender = (event: Event) => {
      const customEvent = event as CustomEvent<LayoutSourceDetail>;
      const detail = customEvent.detail || {};
      const nextScopeId = String(detail.scopeId || '');
      const nextRole = String(detail.role || '');
      const sections = Array.isArray(detail.sections) ? detail.sections : [];
      setScopeId(nextScopeId);
      setRole(nextRole);
      setAllMetrics(sections.map((section) => ({ metric: section.metric, title: section.title })));
    };
    window.addEventListener('pro-dashboard:render-monthly-table', handleRender as EventListener);
    return () => window.removeEventListener('pro-dashboard:render-monthly-table', handleRender as EventListener);
  }, []);

  useEffect(() => {
    if (!scopeId || !role) {
      return;
    }
    setLayout(loadLayout(scopeId, role));
    const unsubscribe = subscribeLayout(scopeId, role, () => {
      setLayout(loadLayout(scopeId, role));
    });
    return unsubscribe;
  }, [scopeId, role]);

  const orderedMetrics = useMemo<MetricEntry[]>(() => {
    if (!allMetrics.length) {
      return [];
    }
    const ordered = applyLayout(
      allMetrics.map((entry) => ({ ...entry })),
      { order: layout.order, hidden: [] },
    );
    return ordered;
  }, [allMetrics, layout.order]);

  if (!scopeId || !role || !allMetrics.length) {
    return null;
  }

  const hiddenSet = new Set(layout.hidden);

  const persist = (next: MetricLayout) => {
    setLayout(next);
    saveLayout(scopeId, role, next);
  };

  const toggleHidden = (metric: string) => {
    const nextHidden = hiddenSet.has(metric)
      ? layout.hidden.filter((value) => value !== metric)
      : layout.hidden.concat(metric);
    persist({ order: layout.order, hidden: nextHidden });
  };

  const reorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      return;
    }
    const next = orderedMetrics.map((entry) => entry.metric);
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    persist({ order: next, hidden: layout.hidden });
  };

  const handleReset = () => {
    resetLayout(scopeId, role);
  };

  const visibleCount = orderedMetrics.filter((entry) => !hiddenSet.has(entry.metric)).length;

  return (
    <div className="side-card">
      <h3>Poradie metrík</h3>
      <div className="metric-layout-panel">
        <div className="metric-layout-meta">
          {visibleCount} z {orderedMetrics.length} viditeľných · ťahaj pre zmenu poradia
        </div>
        <ol className="metric-layout-list">
          {orderedMetrics.map((entry, index) => {
            const isHidden = hiddenSet.has(entry.metric);
            const isDragOver = dragOverIndex === index;
            return (
              <li
                key={entry.metric}
                className={`metric-layout-item${isHidden ? ' is-hidden' : ''}${isDragOver ? ' is-drag-over' : ''}`}
                draggable
                onDragStart={(event) => {
                  dragIndexRef.current = index;
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', entry.metric);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  if (dragOverIndex !== index) {
                    setDragOverIndex(index);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverIndex === index) {
                    setDragOverIndex(null);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const fromIndex = dragIndexRef.current;
                  dragIndexRef.current = null;
                  setDragOverIndex(null);
                  if (fromIndex == null) {
                    return;
                  }
                  reorder(fromIndex, index);
                }}
                onDragEnd={() => {
                  dragIndexRef.current = null;
                  setDragOverIndex(null);
                }}
              >
                <span className="metric-layout-handle" aria-hidden="true">⋮⋮</span>
                <label className="metric-layout-label">
                  <input
                    type="checkbox"
                    checked={!isHidden}
                    onChange={() => toggleHidden(entry.metric)}
                  />
                  <span>{entry.title || entry.metric}</span>
                </label>
              </li>
            );
          })}
        </ol>
        <button
          className="secondary-btn metric-layout-reset"
          type="button"
          onClick={handleReset}
        >
          Resetovať poradie a viditeľnosť
        </button>
      </div>
    </div>
  );
}
