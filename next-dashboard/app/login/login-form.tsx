'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

import styles from './login.module.css';

type LoginFormProps = {
  callbackUrl: string;
  googleEnabled: boolean;
  devLoginEnabled: boolean;
  initialError?: string;
};

const errorMessages: Record<string, string> = {
  AccessDenied: 'Prístup zamietnutý. Tvoj účet nie je zaregistrovaný v systéme — kontaktuj admina.',
  Configuration: 'Chyba konfigurácie autentizácie. Skús to neskôr.',
  CredentialsSignin: 'Email nenájdený alebo účet neaktívny.',
  default: 'Prihlásenie zlyhalo.',
};

function resolveError(error: string) {
  if (!error) return '';
  return errorMessages[error] || errorMessages.default;
}

export function LoginForm({ callbackUrl, googleEnabled, devLoginEnabled, initialError = '' }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(resolveError(initialError));

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    await signIn('google', { callbackUrl });
  };

  const handleDevSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setErrorMessage('');
    const result = await signIn('dev-login', {
      email: email.trim().toLowerCase(),
      callbackUrl,
      redirect: false,
    });
    if (result?.error) {
      setErrorMessage(resolveError(result.error));
      setSubmitting(false);
      return;
    }
    if (result?.url) {
      window.location.href = result.url;
    }
  };

  return (
    <div className={styles.formStack}>
      {errorMessage ? <div className={styles.error} role="alert">{errorMessage}</div> : null}

      {googleEnabled ? (
        <button
          type="button"
          className={styles.googleButton}
          onClick={handleGoogleSignIn}
          disabled={submitting}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.331A8.997 8.997 0 0 0 9 18z"
              fill="#34A853"
            />
            <path
              d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.331z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.293C4.672 5.165 6.656 3.58 9 3.58z"
              fill="#EA4335"
            />
          </svg>
          Prihlásiť sa cez Google
        </button>
      ) : null}

      {googleEnabled && devLoginEnabled ? (
        <div className={styles.divider}>
          <span>alebo dev login</span>
        </div>
      ) : null}

      {devLoginEnabled ? (
        <form className={styles.devForm} onSubmit={handleDevSignIn}>
          <label className={styles.fieldLabel}>
            <span>Email (dev mode)</span>
            <input
              className={styles.input}
              type="email"
              placeholder="sk1020hl@kaufland.sk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={submitting}
            />
          </label>
          <button type="submit" className={styles.devButton} disabled={submitting || !email.trim()}>
            {submitting ? 'Prihlasovanie…' : 'Prihlásiť (dev)'}
          </button>
          <p className={styles.devHint}>
            Dev login je dostupný len v development móde — heslo nie je potrebné. Užívateľ musí
            existovať v User tabuľke.
          </p>
        </form>
      ) : null}

      {!googleEnabled && !devLoginEnabled ? (
        <div className={styles.error}>
          Nie je nakonfigurovaný žiadny provider. Doplňte GOOGLE_CLIENT_ID a GOOGLE_CLIENT_SECRET do
          .env, alebo zapnite DEV_LOGIN_ENABLED=true.
        </div>
      ) : null}
    </div>
  );
}
