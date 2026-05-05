type LegacyIndexLoginShellProps = {
  initialLogin?: string;
};

export function LegacyIndexLoginShell({ initialLogin = '' }: LegacyIndexLoginShellProps) {
  const hasInitialLogin = Boolean(initialLogin.trim());

  return (
    <section className={`login-shell${hasInitialLogin ? ' hidden' : ''}`} id="loginShell">
      <div className="login-shell-utility-bar" aria-label="Rýchle akcie prihlásenia">
        <button className="shell-utility-button js-theme-mode-toggle" type="button" role="switch" aria-checked="false" aria-label="Prepnúť tmavý mód" title="Prepnúť vzhľad" data-theme-toggle="mode" data-theme-mode="light">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2" /><path d="M12 19.3v2.2" /><path d="M21.5 12h-2.2" /><path d="M4.7 12H2.5" /><path d="M18.7 5.3l-1.6 1.6" /><path d="M6.9 17.1l-1.6 1.6" /><path d="M18.7 18.7l-1.6-1.6" /><path d="M6.9 6.9L5.3 5.3" /></svg>
        </button>
      </div>
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
        <div className="error-banner hidden" id="loginError" />
      </div>
    </section>
  );
}