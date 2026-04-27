'use client';

import { useEffect, useState, useTransition } from 'react';

type StoreRow = {
  id: string;
  name: string;
  gfName: string;
  vklName: string;
};

type UserRow = {
  id?: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'GF' | 'VKL' | 'VOD';
  gfName: string;
  vklName: string;
  primaryStoreId: string;
  markedForDelete?: boolean;
};

type EditorPayload = {
  stores: StoreRow[];
  users: UserRow[];
};

const EMPTY_STORE: StoreRow = { id: '', name: '', gfName: '', vklName: '' };
const EMPTY_USER: UserRow = { email: '', name: '', role: 'VOD', gfName: '', vklName: '', primaryStoreId: '' };

export function StructureUsersEditor() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setMessage('Načítavam aktuálnu štruktúru a loginy...');
      const response = await fetch('/api/admin/structure-users', { cache: 'no-store' });
      const payload = await response.json();
      if (!isMounted) {
        return;
      }
      if (!response.ok) {
        setMessage(payload.error || 'Načítanie editora zlyhalo.');
        setIsLoading(false);
        return;
      }
      setStores(Array.isArray(payload.stores) ? payload.stores : []);
      setUsers(Array.isArray(payload.users) ? payload.users : []);
      setMessage('Editor je pripravený.');
      setIsLoading(false);
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const setStoreField = (index: number, field: keyof StoreRow, value: string) => {
    setStores((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  };

  const setUserField = (index: number, field: keyof UserRow, value: string | boolean) => {
    setUsers((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  };

  const addStoreRow = () => setStores((current) => current.concat({ ...EMPTY_STORE }));
  const addUserRow = () => setUsers((current) => current.concat({ ...EMPTY_USER }));
  const removeStoreRow = (index: number) => setStores((current) => current.filter((_, rowIndex) => rowIndex !== index));
  const removeUserRow = (index: number) => setUsers((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, markedForDelete: true } : row));
  const restoreUserRow = (index: number) => setUsers((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, markedForDelete: false } : row));

  const activeUsers = users.filter((user) => !user.markedForDelete);

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <div>
          <span className="kicker">Priama úprava</span>
          <h2>Štruktúra a loginy priamo v UI</h2>
        </div>
      </div>

      <p className="note">Tu vieš meniť GF, VKL, názvy filiálok a prihlasovacie emaily priamo bez uploadu Excelu. Ukladanie robí priame zápisy do SQL.</p>

      <div className="editor-toolbar">
        <button type="button" className="secondary-btn" onClick={addStoreRow} disabled={isLoading || isPending}>Pridať filiálku</button>
        <button type="button" className="secondary-btn" onClick={addUserRow} disabled={isLoading || isPending}>Pridať používateľa</button>
        <button
          type="button"
          onClick={() => {
            startTransition(async () => {
              setMessage('Ukladám zmeny...');
              const response = await fetch('/api/admin/structure-users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stores, users }),
              });
              const payload = await response.json();
              if (!response.ok) {
                setMessage(payload.error || 'Uloženie zlyhalo.');
                return;
              }
              setMessage(`Uložené. Filiálky: ${payload.storesSaved}, používatelia: ${payload.usersSaved}, zmazaní používatelia: ${payload.usersDeleted}.`);
            });
          }}
          disabled={isLoading || isPending}
        >
          {isPending ? 'Ukladám...' : 'Uložiť zmeny'}
        </button>
      </div>

      <p className="upload-message">{message}</p>

      <div className="admin-editor-grid">
        <section>
          <div className="editor-section-head">
            <h3>Filiálky</h3>
            <span>{stores.length} riadkov</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>GF</th>
                  <th>VKL</th>
                  <th>Filiálka</th>
                  <th>Názov</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stores.map((row, index) => (
                  <tr key={`${row.id || 'new'}-${index}`}>
                    <td><input value={row.gfName} onChange={(event) => setStoreField(index, 'gfName', event.target.value)} /></td>
                    <td><input value={row.vklName} onChange={(event) => setStoreField(index, 'vklName', event.target.value)} /></td>
                    <td><input value={row.id} onChange={(event) => setStoreField(index, 'id', event.target.value)} /></td>
                    <td><input value={row.name} onChange={(event) => setStoreField(index, 'name', event.target.value)} /></td>
                    <td><button type="button" className="secondary-btn" onClick={() => removeStoreRow(index)}>Odstrániť</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="editor-section-head">
            <h3>Prihlásenia</h3>
            <span>{activeUsers.length} aktívnych</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Rola</th>
                  <th>Meno</th>
                  <th>Email</th>
                  <th>GF</th>
                  <th>VKL</th>
                  <th>Filiálka</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((row, index) => (
                  <tr key={`${row.email || 'new'}-${index}`} className={row.markedForDelete ? 'admin-row--deleted' : ''}>
                    <td>
                      <select value={row.role} onChange={(event) => setUserField(index, 'role', event.target.value)}>
                        <option value="ADMIN">ADMIN</option>
                        <option value="GF">GF</option>
                        <option value="VKL">VKL</option>
                        <option value="VOD">VOD</option>
                      </select>
                    </td>
                    <td><input value={row.name} onChange={(event) => setUserField(index, 'name', event.target.value)} /></td>
                    <td><input value={row.email} onChange={(event) => setUserField(index, 'email', event.target.value)} /></td>
                    <td><input value={row.gfName} onChange={(event) => setUserField(index, 'gfName', event.target.value)} /></td>
                    <td><input value={row.vklName} onChange={(event) => setUserField(index, 'vklName', event.target.value)} /></td>
                    <td><input value={row.primaryStoreId} onChange={(event) => setUserField(index, 'primaryStoreId', event.target.value)} /></td>
                    <td>
                      {row.markedForDelete ? (
                        <button type="button" className="secondary-btn" onClick={() => restoreUserRow(index)}>Obnoviť</button>
                      ) : (
                        <button type="button" className="secondary-btn" onClick={() => removeUserRow(index)}>Zmazať</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}