'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'proDashboardThemeMode';

function readInitialMode(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const initial = readInitialMode();
    setMode(initial);
    document.body.classList.toggle('theme-dark', initial === 'dark');
    document.documentElement.classList.toggle('theme-dark', initial === 'dark');
  }, []);

  const toggle = () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    document.body.classList.toggle('theme-dark', next === 'dark');
    document.documentElement.classList.toggle('theme-dark', next === 'dark');
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const isDark = mode === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Prepnúť na svetlý mód' : 'Prepnúť na tmavý mód'}
      title="Prepnúť vzhľad"
      onClick={toggle}
      className={`shell-utility-button ${isDark ? 'is-active' : ''} ${className}`.trim()}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2" />
          <path d="M12 19.3v2.2" />
          <path d="M21.5 12h-2.2" />
          <path d="M4.7 12H2.5" />
          <path d="M18.7 5.3l-1.6 1.6" />
          <path d="M6.9 17.1l-1.6 1.6" />
          <path d="M18.7 18.7l-1.6-1.6" />
          <path d="M6.9 6.9L5.3 5.3" />
        </svg>
      )}
    </button>
  );
}
