'use client';

import { useEffect } from 'react';

export function AutoLoginTrigger() {
  useEffect(() => {
    function trigger() {
      const btn = document.getElementById('loginButton') as HTMLButtonElement | null;
      btn?.click();
    }
    window.addEventListener('pro-dashboard:scripts-ready', trigger, { once: true });
    return () => window.removeEventListener('pro-dashboard:scripts-ready', trigger);
  }, []);
  return null;
}
