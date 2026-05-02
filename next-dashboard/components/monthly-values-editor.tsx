'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

type SourceName = 'PLAN' | 'IST' | 'VOD';

type StoreOption = {
  id: string;
  name: string;
  gfName: string;
  vklName: string;
};

type MonthOption = {
  id: string;
  label: string;
  businessYear: number;
  businessOrder: number;
};

type EditorRow = {
  metricCode: string;
  metricName: string;
  values: Record<string, string>;
};

type EditorApiRow = {
  metricCode?: string;
  metricName?: string;
  values?: Record<string, number | string | null | undefined>;
};

type EditorApiPayload = {
  stores?: StoreOption[];
  months?: MonthOption[];
  rows?: EditorApiRow[];
  error?: string;
};

const SOURCE_OPTIONS: Array<{ value: SourceName; label: string; description: string }> = [
  { value: 'PLAN', label: 'PLAN', description: 'Plánované mesačné hodnoty pre vybranú filiálku.' },
  { value: 'IST', label: 'IST', description: 'Reálne mesačné IST hodnoty pre vybranú filiálku.' },
  { value: 'VOD', label: 'IST VOD', description: 'Mesačné VOD úpravy pre forecast jednej filiálky.' },
];

function formatStoreLabel(store: StoreOption) {
  const parts = [store.id, store.name].filter(Boolean);
  const org = [store.gfName, store.vklName].filter(Boolean).join(' / ');
  return org ? `${parts.join(' · ')} · ${org}` : parts.join(' · ');
}

function buildEmptyRow(months: MonthOption[]): EditorRow {
  return {
    metricCode: '',
    metricName: '',
    values: Object.fromEntries(months.map((month) => [month.id, ''])),
  };
}

function normalizeMetricCode(metricName: string) {
  return metricName
    .trim()
    .toLowerCase()
    .replace(/[áä]/g, 'a')
    .replace(/[č]/g, 'c')
    .replace(/[ď]/g, 'd')
    .replace(/[éě]/g, 'e')
    .replace(/[í]/g, 'i')
    .replace(/[ĺľ]/g, 'l')
    .replace(/[ň]/g, 'n')
    .replace(/[óô]/g, 'o')
    .replace(/[ŕř]/g, 'r')
    .replace(/[š]/g, 's')
    .replace(/[ť]/g, 't')
    .replace(/[úů]/g, 'u')
    .replace(/[ý]/g, 'y')
    .replace(/[ž]/g, 'z')
    .replace(/>/g, '+')
    .replace(/[^a-z0-9+ ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function MonthlyValuesEditor({ adminSecret = '' }: { adminSecret?: string }) {
  const [source, setSource] = useState<SourceName>('PLAN');
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [rows, setRows] = useState<EditorRow[]>([]);
  const [message, setMessage] = useState('Zadaj admin heslo a načítaj dáta.');
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    async function loadData() {      if (!adminSecret) {
        setMessage('Zadaj admin heslo pre načítanie dát.');
        setIsLoading(false);
        return;
      }      setIsLoading(true);
      setMessage('Načítavam mesačné dáta...');

      const params = new URLSearchParams({ source });
      if (selectedStoreId) {
        params.set('storeId', selectedStoreId);
      }

      const response = await fetch(`/api/admin/monthly-values?${params.toString()}`, {
        cache: 'no-store',
        headers: { 'x-admin-secret': adminSecret },
      });
      const payload = await response.json() as EditorApiPayload;

      if (!isMounted) {
        return;
      }

      if (!response.ok) {
        setMessage(payload.error || 'Načítanie mesačných dát zlyhalo.');
        setIsLoading(false);
        return;
      }

      const loadedStores = Array.isArray(payload.stores) ? payload.stores : [];
      const loadedMonths = Array.isArray(payload.months) ? payload.months : [];
      const loadedRows = Array.isArray(payload.rows)
        ? payload.rows.map((row: EditorApiRow) => ({
            metricCode: String(row.metricCode || ''),
            metricName: String(row.metricName || ''),
            values: Object.fromEntries(
              loadedMonths.map((month: MonthOption) => [month.id, row.values?.[month.id] == null ? '' : String(row.values[month.id])]),
            ),
          }))
        : [];

      setStores(loadedStores);
      setMonths(loadedMonths);
      setRows(loadedRows);

      if (!selectedStoreId && loadedStores.length) {
        setSelectedStoreId(loadedStores[0].id);
        setMessage('Vyber filiálku pre úpravu mesačných dát.');
      } else if (selectedStoreId && !loadedStores.some((store: StoreOption) => store.id === selectedStoreId)) {
        setSelectedStoreId(loadedStores[0]?.id || '');
        setMessage('Pôvodne vybraná filiálka už nie je dostupná.');
      } else if (selectedStoreId) {
        setMessage(`Editor ${source} je pripravený pre filiálku ${selectedStoreId}.`);
      } else {
        setMessage('Najprv nahraj alebo vytvor filiálky v štruktúre.');
      }

      setIsLoading(false);
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [selectedStoreId, source, adminSecret]);

  const selectedSource = useMemo(
    () => SOURCE_OPTIONS.find((entry) => entry.value === source) || SOURCE_OPTIONS[0],
    [source],
  );

  const filledCellCount = useMemo(
    () => rows.reduce((total, row) => total + months.filter((month) => String(row.values[month.id] || '').trim()).length, 0),
    [months, rows],
  );

  const setMetricName = (index: number, metricName: string) => {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index
      ? { ...row, metricName, metricCode: row.metricCode || normalizeMetricCode(metricName) }
      : row));
  };

  const setCellValue = (index: number, monthId: string, value: string) => {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index
      ? { ...row, values: { ...row.values, [monthId]: value } }
      : row));
  };

  const addRow = () => setRows((current) => current.concat(buildEmptyRow(months)));
  const removeRow = (index: number) => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <div>
          <span className="kicker">Priama úprava</span>
          <h2>PLAN, IST a IST VOD pre jednu filiálku</h2>
        </div>
      </div>

      <p className="note">Tento editor je určený na lokálne zásahy pre jednu konkrétnu filiálku. Pri `IST VOD` upravuješ mesačné forecast úpravy, pri `IST` a `PLAN` priamo zdrojové mesačné hodnoty v SQL.</p>

      <div className="segmented-tabs" role="tablist" aria-label="Zdroj dát">
        {SOURCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`tab-button${source === option.value ? ' tab-button--active' : ''}`}
            onClick={() => setSource(option.value)}
            disabled={isLoading || isPending}
          >
            {option.label}
          </button>
        ))}
      </div>

      <p className="upload-help-text">{selectedSource.description}</p>

      <div className="editor-toolbar editor-toolbar--filters">
        <label className="editor-field">
          <span>Filiálka</span>
          <select value={selectedStoreId} onChange={(event) => setSelectedStoreId(event.target.value)} disabled={isLoading || isPending || !stores.length}>
            {!stores.length ? <option value="">Žiadne filiálky</option> : null}
            {stores.map((store) => (
              <option key={store.id} value={store.id}>{formatStoreLabel(store)}</option>
            ))}
          </select>
        </label>

        <div className="editor-summary-chip">
          <strong>{rows.length}</strong>
          <span>metrík</span>
        </div>

        <div className="editor-summary-chip">
          <strong>{filledCellCount}</strong>
          <span>vyplnených buniek</span>
        </div>
      </div>

      <div className="editor-toolbar">
        <button type="button" className="secondary-btn" onClick={addRow} disabled={isLoading || isPending || !selectedStoreId}>Pridať metrický riadok</button>
        <button
          type="button"
          onClick={() => {
            if (!selectedStoreId) {
              setMessage('Najprv vyber filiálku.');
              return;
            }

            startTransition(async () => {
              setMessage('Ukladám mesačné dáta...');
              const response = await fetch('/api/admin/monthly-values', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
                body: JSON.stringify({
                  source,
                  storeId: selectedStoreId,
                  rows: rows.map((row) => ({
                    metricCode: row.metricCode || normalizeMetricCode(row.metricName),
                    metricName: row.metricName,
                    values: row.values,
                  })),
                }),
              });
              const payload = await response.json();
              if (!response.ok) {
                setMessage(payload.error || 'Uloženie mesačných dát zlyhalo.');
                return;
              }
              setMessage(`Uložené. Zdroj: ${source}, filiálka: ${selectedStoreId}, metrík: ${payload.rowsSaved}, buniek: ${payload.valuesSaved}.`);
            });
          }}
          disabled={isLoading || isPending || !selectedStoreId}
        >
          {isPending ? 'Ukladám...' : 'Uložiť mesačné zmeny'}
        </button>
      </div>

      <p className="upload-message">{message}</p>

      <div className="admin-table-wrap">
        <table className="admin-table admin-table--wide">
          <thead>
            <tr>
              <th>Metrika</th>
              {months.map((month) => (
                <th key={month.id}>{month.label}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.metricCode || 'new'}-${index}`}>
                <td className="metric-name-cell">
                  <input
                    value={row.metricName}
                    onChange={(event) => setMetricName(index, event.target.value)}
                    placeholder="napr. Obrat GJ2026"
                  />
                </td>
                {months.map((month) => (
                  <td key={month.id} className="month-value-cell">
                    <input
                      value={row.values[month.id] || ''}
                      onChange={(event) => setCellValue(index, month.id, event.target.value)}
                      placeholder="0"
                      inputMode="decimal"
                    />
                  </td>
                ))}
                <td>
                  <button type="button" className="secondary-btn" onClick={() => removeRow(index)}>Odstrániť</button>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={months.length + 2}>
                  {selectedStoreId
                    ? 'Pre tento zdroj a filiálku zatiaľ nie sú žiadne riadky. Môžeš pridať nový.'
                    : 'Najprv vyber filiálku.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}