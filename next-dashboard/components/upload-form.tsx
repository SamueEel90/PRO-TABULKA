'use client';

import { useEffect, useRef, useState } from 'react';

type ImportMode = 'monthly' | 'plan' | 'structure-login' | 'reset-ist-vod' | 'reset-vod' | 'reset-discussions';

type Phase = { label: string; weight: number };

/**
 * Phase timeline per import mode. Weights are *relative* expected durations.
 * The progress bar advances time-proportionally within each phase up to ~92%,
 * then jumps to 100% on the actual server response. Estimates intentionally
 * lean slow so the bar doesn't sit pinned at 92% pretending to be done.
 */
const PHASES: Record<ImportMode, Phase[]> = {
  monthly: [
    { label: 'Nahrávam súbor', weight: 1 },
    { label: 'Parsujem Excel/CSV', weight: 1 },
    { label: 'Zapisujem Stores do Sheets', weight: 2 },
    { label: 'Zapisujem Months a Metrics do Sheets', weight: 2 },
    { label: 'Zapisujem MonthlyValue do Sheets', weight: 6 },
    { label: 'Aktualizujem lokálny cache', weight: 2 },
  ],
  plan: [
    { label: 'Nahrávam súbor', weight: 1 },
    { label: 'Parsujem Excel/CSV', weight: 1 },
    { label: 'Zapisujem Stores do Sheets', weight: 2 },
    { label: 'Zapisujem Months a Metrics do Sheets', weight: 2 },
    { label: 'Zapisujem PLAN hodnoty do Sheets', weight: 8 },
    { label: 'Aktualizujem lokálny cache', weight: 2 },
  ],
  'structure-login': [
    { label: 'Nahrávam súbor', weight: 1 },
    { label: 'Parsujem štruktúru a loginy', weight: 1 },
    { label: 'Zapisujem Stores do Sheets', weight: 3 },
    { label: 'Zapisujem Users do Sheets', weight: 3 },
    { label: 'Aktualizujem lokálny cache', weight: 1 },
  ],
  'reset-ist-vod': [
    { label: 'Načítavam aktuálny stav', weight: 1 },
    { label: 'Mažem IST a VOD v Sheets', weight: 4 },
    { label: 'Mažem týždenné VOD overrides', weight: 2 },
    { label: 'Čistím lokálny cache', weight: 1 },
  ],
  'reset-vod': [
    { label: 'Načítavam aktuálny stav', weight: 1 },
    { label: 'Mažem VOD v Sheets', weight: 3 },
    { label: 'Mažem týždenné VOD overrides', weight: 2 },
    { label: 'Čistím lokálny cache', weight: 1 },
  ],
  'reset-discussions': [
    { label: 'Načítavam aktuálny stav', weight: 1 },
    { label: 'Mažem komentáre a úlohy v Sheets', weight: 3 },
    { label: 'Mažem poznámky v Sheets', weight: 2 },
    { label: 'Čistím lokálny cache', weight: 1 },
  ],
};

/** Approx total expected duration per mode (ms). Tuned from observed runs. */
const EXPECTED_DURATION_MS: Record<ImportMode, number> = {
  monthly: 35_000,
  plan: 60_000,
  'structure-login': 20_000,
  'reset-ist-vod': 15_000,
  'reset-vod': 12_000,
  'reset-discussions': 10_000,
};

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return mm > 0 ? `${mm}m ${ss.toString().padStart(2, '0')}s` : `${ss}s`;
}

function phaseAtProgress(mode: ImportMode, pct: number): string {
  const phases = PHASES[mode];
  const totalWeight = phases.reduce((acc, p) => acc + p.weight, 0);
  let cumulative = 0;
  for (const phase of phases) {
    cumulative += (phase.weight / totalWeight) * 100;
    if (pct <= cumulative) return phase.label;
  }
  return phases[phases.length - 1].label;
}

export function UploadForm({ adminSecret = '' }: { adminSecret?: string }) {
  const [importMode, setImportMode] = useState<ImportMode>('monthly');
  const [message, setMessage] = useState<string>('');
  const [isError, setIsError] = useState<boolean>(false);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [phaseLabel, setPhaseLabel] = useState<string>('');
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [isDone, setIsDone] = useState<boolean>(false);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const uploadEndpoint = importMode === 'structure-login'
    ? '/api/import/structure-users'
    : importMode === 'reset-ist-vod'
      ? '/api/import/reset-ist-vod'
      : importMode === 'reset-vod'
        ? '/api/import/reset-vod'
        : importMode === 'reset-discussions'
          ? '/api/import/reset-discussions'
          : importMode === 'plan'
            ? '/api/import/monthly-plan'
            : '/api/import/monthly-ist';

  const acceptedFileTypes = importMode === 'structure-login'
    ? '.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : '.xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  useEffect(() => {
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, []);

  function stopTicker() {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }

  function startTicker(mode: ImportMode, startedAt: number) {
    stopTicker();
    const expected = EXPECTED_DURATION_MS[mode];
    tickerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setElapsedMs(elapsed);
      // Asymptote toward 92% — never pretend done before the server says so.
      const raw = (elapsed / expected) * 92;
      const capped = Math.min(92, raw);
      setProgress((prev) => (capped > prev ? capped : prev));
      setPhaseLabel(phaseAtProgress(mode, capped));
    }, 250);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const startedAt = Date.now();

    setIsPending(true);
    setIsError(false);
    setIsDone(false);
    setProgress(2);
    setElapsedMs(0);
    setPhaseLabel(PHASES[importMode][0].label);
    setMessage('');
    startTicker(importMode, startedAt);

    try {
      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: { 'x-admin-secret': adminSecret },
        body: formData,
      });
      const payload = await response.json();
      stopTicker();
      setElapsedMs(Date.now() - startedAt);

      if (!response.ok) {
        setIsError(true);
        setMessage(payload.error || 'Import zlyhal.');
        setPhaseLabel('Chyba');
        return;
      }

      setProgress(100);
      setIsDone(true);
      setPhaseLabel('Hotovo');

      if (importMode === 'structure-login') {
        setMessage(`Hotovo. Štruktúra: ${payload.structureSheetName}, Login: ${payload.loginSheetName}. Filiálok: ${payload.stores}. Používateľov: ${payload.users}. Súbor: ${payload.fileName}`);
      } else if (importMode === 'reset-ist-vod') {
        setMessage(`Hotovo. Zmazané IST riadky: ${payload.deletedIstRows}. Zmazané VOD riadky: ${payload.deletedVodRows}. Zmazané týždenné VOD úpravy: ${payload.deletedWeeklyOverrides}.`);
      } else if (importMode === 'reset-vod') {
        setMessage(`Hotovo. Zmazané VOD riadky: ${payload.deletedVodRows}. Zmazané týždenné VOD úpravy: ${payload.deletedWeeklyOverrides}.`);
      } else if (importMode === 'reset-discussions') {
        setMessage(`Hotovo. Zmazané komentáre: ${payload.deletedComments}. Zmazané úlohy: ${payload.deletedTasks}. Zmazané poznámky: ${payload.deletedNotes}.`);
      } else if (importMode === 'plan') {
        setMessage(`Hotovo. PLAN sheet ${payload.sheetName}. Filiálok: ${payload.stores}, mesiacov: ${payload.months}, metrík: ${payload.metrics}. Importovaných riadkov: ${payload.rowCount}. Súbor: ${payload.fileName}`);
      } else {
        setMessage(`Hotovo. IST sheet ${payload.sheetName}. Importované mesiace: ${payload.importedMonthRange}. Importovaných riadkov: ${payload.rowCount}. Súbor: ${payload.fileName}`);
      }

      form.reset();
      if (importMode === 'reset-ist-vod' || importMode === 'reset-vod' || importMode === 'reset-discussions') {
        setImportMode('monthly');
      }
    } catch (error) {
      stopTicker();
      setIsError(true);
      setPhaseLabel('Chyba');
      setMessage(error instanceof Error ? error.message : 'Sieťová chyba pri komunikácii so serverom.');
    } finally {
      setIsPending(false);
    }
  }

  const showProgress = isPending || isDone || isError;

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <label>
        <span>Čo chceš nahrať</span>
        <select
          name="importMode"
          value={importMode}
          onChange={(event) => setImportMode(event.target.value as ImportMode)}
          disabled={isPending}
        >
          <option value="monthly">ISTGJ2026 import</option>
          <option value="plan">PLANGJ2026 import (ročný plán)</option>
          <option value="structure-login">Štruktúra GF / VKL / filiálky + loginy</option>
          <option value="reset-ist-vod">Vymazať všetok IST a úpravy VOD</option>
          <option value="reset-vod">Vymazať len úpravy VOD</option>
          <option value="reset-discussions">Vymazať komentáre a poznámky</option>
        </select>
      </label>

      {importMode === 'monthly' ? (
        <p className="upload-help-text">Nahraj jeden workbook alebo CSV pre `ISTGJ2026`. Pri Exceli sa použije sheet `ISTGJ2026` a import vezme všetky mesiace od začiatku obchodného roka po aktuálny mesiac. Budúce mesiace sa ignorujú.</p>
      ) : importMode === 'plan' ? (
        <p className="upload-help-text">Nahraj workbook alebo CSV pre `PLANGJ2026` (ročný plán). Importujú sa všetky mesiace obchodného roka (marec - február). Existujúce PLAN hodnoty pre tieto filiálky a mesiace sa prepíšu.</p>
      ) : importMode === 'structure-login' ? (
        <>
          <label>
            <span>Sheet so štruktúrou</span>
            <input name="structureSheetName" type="text" defaultValue="Struktura" placeholder="napr. Struktura" disabled={isPending} />
          </label>

          <label>
            <span>Sheet s loginmi</span>
            <input name="loginSheetName" type="text" defaultValue="Login" placeholder="napr. Login" disabled={isPending} />
          </label>

          <p className="upload-help-text">Workbook má obsahovať sheet `Struktura` s stĺpcami GF, VKL, FILIALKA, Nazov Filialky a sheet `Login` s pármi stĺpcov ADMIN/ADMIN EMAIL, GF/GF EMAIL, VKL/VKL EMAIL, VOD/VOD EMAIL.</p>
        </>
      ) : importMode === 'reset-ist-vod' ? (
        <p className="upload-help-text">Táto akcia zmaže všetky mesačné IST dáta, všetky mesačné úpravy VOD aj všetky týždenné VOD override. Štruktúra, loginy a PLAN ostanú bez zmeny.</p>
      ) : importMode === 'reset-vod' ? (
        <p className="upload-help-text">Táto akcia zmaže len mesačné úpravy VOD a týždenné VOD override. IST dáta, štruktúra, loginy a PLAN ostanú bez zmeny.</p>
      ) : (
        <p className="upload-help-text">Táto akcia zmaže všetky komentáre v thread-och, priradené úlohy a jednorázové poznámky k metrikám. Mesačné dáta (IST/PLAN/VOD), štruktúra ani používatelia sa nedotknú. Audit log (ActivityEntry) zostáva.</p>
      )}

      {importMode !== 'reset-ist-vod' && importMode !== 'reset-vod' && importMode !== 'reset-discussions' ? (
        <label>
          <span>{importMode === 'structure-login' ? 'Excel workbook' : importMode === 'plan' ? 'Súbor PLANGJ2026' : 'Súbor ISTGJ2026'}</span>
          <input name="file" type="file" accept={acceptedFileTypes} required disabled={isPending} />
        </label>
      ) : null}

      <label>
        <span>Kto nahráva</span>
        <input name="uploadedBy" type="text" placeholder="napr. admin@firma.sk" disabled={isPending} />
      </label>

      <button type="submit" disabled={isPending}>
        {isPending
          ? importMode === 'reset-ist-vod' || importMode === 'reset-vod' || importMode === 'reset-discussions'
            ? 'Mažem...'
            : 'Importujem...'
          : importMode === 'structure-login'
            ? 'Nahrať štruktúru a loginy'
            : importMode === 'reset-ist-vod'
              ? 'Vymazať IST a VOD'
              : importMode === 'reset-vod'
                ? 'Vymazať úpravy VOD'
                : importMode === 'reset-discussions'
                  ? 'Vymazať komentáre a poznámky'
                  : importMode === 'plan'
                    ? 'Nahrať PLANGJ2026'
                    : 'Nahrať ISTGJ2026'}
      </button>

      {showProgress ? (
        <div className="upload-progress" role="status" aria-live="polite">
          <div className="upload-progress__head">
            <span className="upload-progress__phase">{phaseLabel}</span>
            <span className="upload-progress__meta">
              {Math.round(progress)}% · {formatElapsed(elapsedMs)}
            </span>
          </div>
          <div className="upload-progress__track">
            <div
              className={
                'upload-progress__fill'
                + (isPending && !isDone && !isError ? ' upload-progress__stripes' : '')
                + (isDone ? ' is-done' : '')
                + (isError ? ' is-error' : '')
              }
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      <p className={'upload-message' + (isError ? ' is-error' : '')}>{message}</p>
    </form>
  );
}
