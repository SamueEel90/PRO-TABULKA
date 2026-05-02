'use client';

import { useState, useTransition } from 'react';

export function UploadForm({ adminSecret = '' }: { adminSecret?: string }) {
  const [importMode, setImportMode] = useState<'monthly' | 'structure-login' | 'reset-ist-vod'>('monthly');
  const [message, setMessage] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const uploadEndpoint = importMode === 'structure-login'
    ? '/api/import/structure-users'
    : importMode === 'reset-ist-vod'
      ? '/api/import/reset-ist-vod'
      : '/api/import/monthly-ist';
  const acceptedFileTypes = importMode === 'structure-login'
    ? '.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : '.xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  return (
    <form
      className="upload-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);

        startTransition(async () => {
          setMessage(
            importMode === 'structure-login'
              ? 'Nahrávam štruktúru a loginy...'
              : importMode === 'reset-ist-vod'
                ? 'Mažem všetky IST a úpravy VOD...'
                : 'Nahrávam a importujem mesačné dáta...',
          );
          const response = await fetch(uploadEndpoint, {
            method: 'POST',
            headers: { 'x-admin-secret': adminSecret },
            body: formData,
          });
          const payload = await response.json();
          if (!response.ok) {
            setMessage(payload.error || 'Import zlyhal.');
            return;
          }
          if (importMode === 'structure-login') {
            setMessage(`Hotovo. Štruktúra: ${payload.structureSheetName}, Login: ${payload.loginSheetName}. Filiálok: ${payload.stores}. Používateľov: ${payload.users}. Súbor: ${payload.fileName}`);
          } else if (importMode === 'reset-ist-vod') {
            setMessage(`Hotovo. Zmazané IST riadky: ${payload.deletedIstRows}. Zmazané VOD riadky: ${payload.deletedVodRows}. Zmazané týždenné VOD úpravy: ${payload.deletedWeeklyOverrides}.`);
          } else {
            setMessage(`Hotovo. IST sheet ${payload.sheetName}. Importované mesiace: ${payload.importedMonthRange}. Importovaných riadkov: ${payload.rowCount}. Súbor: ${payload.fileName}`);
          }
          form.reset();
          if (importMode === 'reset-ist-vod') {
            setImportMode('monthly');
          }
        });
      }}
    >
      <label>
        <span>Čo chceš nahrať</span>
        <select name="importMode" value={importMode} onChange={(event) => setImportMode(event.target.value as 'monthly' | 'structure-login' | 'reset-ist-vod')}>
          <option value="monthly">ISTGJ2026 import</option>
          <option value="structure-login">Štruktúra GF / VKL / filiálky + loginy</option>
          <option value="reset-ist-vod">Vymazať všetok IST a úpravy VOD</option>
        </select>
      </label>

      {importMode === 'monthly' ? (
        <>
          <p className="upload-help-text">Nahraj jeden workbook alebo CSV pre `ISTGJ2026`. Pri Exceli sa použije sheet `ISTGJ2026` a import vezme všetky mesiace od začiatku obchodného roka po aktuálny mesiac. Budúce mesiace sa ignorujú.</p>
        </>
      ) : importMode === 'structure-login' ? (
        <>
          <label>
            <span>Sheet so štruktúrou</span>
            <input name="structureSheetName" type="text" defaultValue="Struktura" placeholder="napr. Struktura" />
          </label>

          <label>
            <span>Sheet s loginmi</span>
            <input name="loginSheetName" type="text" defaultValue="Login" placeholder="napr. Login" />
          </label>

          <p className="upload-help-text">Workbook má obsahovať sheet `Struktura` s stĺpcami GF, VKL, FILIALKA, Nazov Filialky a sheet `Login` s pármi stĺpcov ADMIN/ADMIN EMAIL, GF/GF EMAIL, VKL/VKL EMAIL, VOD/VOD EMAIL.</p>
        </>
      ) : (
        <p className="upload-help-text">Táto akcia zmaže všetky mesačné IST dáta, všetky mesačné úpravy VOD aj všetky týždenné VOD override. Štruktúra, loginy a PLAN ostanú bez zmeny.</p>
      )}

      {importMode !== 'reset-ist-vod' ? (
        <label>
          <span>{importMode === 'structure-login' ? 'Excel workbook' : 'Súbor ISTGJ2026'}</span>
          <input name="file" type="file" accept={acceptedFileTypes} required />
        </label>
      ) : null}

      <label>
        <span>Kto nahráva</span>
        <input name="uploadedBy" type="text" placeholder="napr. admin@firma.sk" />
      </label>

      <button type="submit" disabled={isPending}>
        {isPending
          ? importMode === 'reset-ist-vod'
            ? 'Mažem...'
            : 'Importujem...'
          : importMode === 'structure-login'
            ? 'Nahrať štruktúru a loginy'
            : importMode === 'reset-ist-vod'
              ? 'Vymazať IST a VOD'
              : 'Nahrať ISTGJ2026'}
      </button>

      <p className="upload-message">{message}</p>
    </form>
  );
}
