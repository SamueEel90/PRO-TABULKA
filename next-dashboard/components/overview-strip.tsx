'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'pro-dashboard:overview-strip-collapsed';

type CollapsedState = { tasks: boolean; activity: boolean };

const DEFAULT_STATE: CollapsedState = { tasks: false, activity: false };

function readState(): CollapsedState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      tasks: Boolean(parsed?.tasks),
      activity: Boolean(parsed?.activity),
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.18s ease' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function OverviewStrip() {
  const [state, setState] = useState<CollapsedState>(DEFAULT_STATE);

  useEffect(() => {
    setState(readState());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const toggle = (key: keyof CollapsedState) =>
    setState((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="overview-strip" id="overviewStrip">
      <div
        className={`overview-strip-card overview-strip-card--tasks${state.tasks ? ' is-collapsed' : ''}`}
      >
        <div className="overview-strip-head">
          <button
            type="button"
            className="overview-strip-toggle"
            aria-expanded={!state.tasks}
            aria-controls="overviewTasksList"
            onClick={() => toggle('tasks')}
          >
            <ChevronIcon collapsed={state.tasks} />
            <span className="overview-strip-label">Otvorené úlohy</span>
          </button>
          <span className="overview-strip-count" id="overviewTasksCount">—</span>
        </div>
        <div className="overview-strip-list" id="overviewTasksList" hidden={state.tasks}>
          <div className="overview-strip-empty">Načítavam…</div>
        </div>
      </div>
      <div
        className={`overview-strip-card overview-strip-card--activity${state.activity ? ' is-collapsed' : ''}`}
      >
        <div className="overview-strip-head">
          <button
            type="button"
            className="overview-strip-toggle"
            aria-expanded={!state.activity}
            aria-controls="overviewActivityList"
            onClick={() => toggle('activity')}
          >
            <ChevronIcon collapsed={state.activity} />
            <span className="overview-strip-label">Posledná aktivita</span>
          </button>
          <span className="overview-strip-count" id="overviewActivityNew">—</span>
        </div>
        <div className="overview-strip-list" id="overviewActivityList" hidden={state.activity}>
          <div className="overview-strip-empty">Načítavam…</div>
        </div>
      </div>
    </div>
  );
}
