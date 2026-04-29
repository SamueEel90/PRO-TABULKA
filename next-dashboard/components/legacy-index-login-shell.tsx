import Link from 'next/link';

type LegacyIndexLoginShellProps = {
  initialLogin?: string;
};

export function LegacyIndexLoginShell({ initialLogin = '' }: LegacyIndexLoginShellProps) {
  const hasInitialLogin = Boolean(initialLogin.trim());

  return (
    <section className={`login-shell${hasInitialLogin ? ' hidden' : ''}`} id="loginShell">
      <div className="login-card">
        <div className="login-brand">
          <img src="https://upload.wikimedia.org/wikipedia/commons/6/65/Kaufland_Deutschland.png" alt="Kaufland logo" />
          Kaufland PRO GJ 2026
        </div>
        <h1>PRO GJ 2026.</h1>
        <p>Dashboard vývoja 2026.</p>
        <div className="login-form">
          <label>
            <div className="field-label">Prihlásenie</div>
            <input className="text-input" defaultValue={initialLogin} id="loginInput" placeholder="napr. testgf@gmail.com alebo 1030" />
          </label>
          <div className="login-action-row">
            <button className="primary-btn" id="loginButton" type="button">Vstúpiť</button>
            <button className="secondary-btn" id="summaryButton" type="button">GF / VKL sumár</button>
          </div>
          <div className="tiny login-help-text">Na prihlásenie použi Google účet.</div>
        </div>
        <div className="demo-hints">
          <strong>Prihlásenie</strong>
          <div className="support-text">Ak nemáš do systému prístup kontaktuj prosím administrátora.</div>
        </div>
        <Link
          href="/test-lab"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '.375rem',
            marginTop: '.75rem',
            padding: '.5em .875em',
            borderRadius: '999px',
            background: 'rgba(55,120,229,.1)',
            color: '#24567c',
            fontSize: '.8125rem',
            fontWeight: 800,
            textDecoration: 'none',
            transition: 'background .15s ease',
          }}
        >
          🧪 Test Lab →
        </Link>
        <div className="error-banner hidden" id="loginError" />
      </div>
    </section>
  );
}