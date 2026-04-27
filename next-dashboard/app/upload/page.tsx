import Link from 'next/link';

import { StructureUsersEditor } from '@/components/structure-users-editor';
import { UploadForm } from '@/components/upload-form';

export default function UploadPage() {
  return (
    <main className="page">
      <div className="topbar">
        <div className="brand">
          <span className="kicker">Excel a CSV Import</span>
          <h1>Nahratie dát, štruktúry a loginov do SQL databázy</h1>
				<p>Upload teraz podporuje jednoduchý IST import z jedného workbooku `ISTGJ2026` a samostatný workbook pre štruktúru GF/VKL/filiálok a login mapping používateľov.</p>
        </div>
        <div className="actions">
          <Link className="link-button" href="/">
            Späť na prehľad
          </Link>
        </div>
      </div>

      <section className="panel">
        <UploadForm />
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <p className="note">V upload formulári je nová akcia na kompletné vymazanie všetkých IST dát a všetkých úprav VOD. Zmaže mesačné IST/VOD hodnoty aj týždenné VOD override, ale nechá PLAN, štruktúru a loginy bez zmeny.</p>
      </section>

      <StructureUsersEditor />

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="brand">
          <span className="kicker">Očakávané formáty</span>
				<h2>Šablóny pre IST a štruktúru</h2>
        </div>
        <pre className="code-block">{`Store ID;Store Name;Metric;marec 2026;apríl 2026;máj 2026
1020;Bratislava Aupark;Obrat GJ2026;801937;52711;502712
; ;Hodiny netto;2311,6;2104,2;2200,4
; ;Čistý výkon;346,9;25,1;228,5`}</pre>
        <p className="note">Pre IST import nahraj workbook so sheetom `ISTGJ2026` alebo CSV v tomto tvare. Import automaticky vezme všetky mesiace od marca po aktuálny business mesiac a budúce stĺpce ignoruje. Prázdny Store ID v ďalších riadkoch znamená pokračovanie predchádzajúcej predajne, rovnako ako v aktuálnych sheetoch.</p>

		<pre className="code-block" style={{ marginTop: 16 }}>{`Sheet: Struktura
GF | VKL | FILIALKA | Nazov Filialky
Ivan Bosák | Barišová Monika | 2020 | 2020 BRATISLAVA Petržalka

Sheet: Login
ADMIN | ADMIN EMAIL | GF | GF EMAIL | VKL | VKL EMAIL | VOD | VOD EMAIL
Samuel | samuel@firma.sk | Ivan Bosák | bosak@firma.sk | Barišová Monika | monika@firma.sk | 2020 | 2020@firma.sk`}</pre>
		<p className="note">Import štruktúry a loginov upsertne GF/VKL väzby na filiálkach a používateľov podľa login sheetu. VOD login sa páruje cez stĺpec `VOD` na kód filiálky.</p>
      </section>
    </main>
  );
}
