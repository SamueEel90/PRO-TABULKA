'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

import styles from './login.module.css';

type LoginFormProps = {
  callbackUrl: string;
  initialError?: string;
};

const errorMessages: Record<string, string> = {
  AccessDenied: 'Prístup zamietnutý — kontaktuj admina.',
  Configuration: 'Chyba konfigurácie autentizácie. Skús to neskôr.',
  CredentialsSignin: 'Nesprávny email alebo heslo.',
  default: 'Prihlásenie zlyhalo.',
};

function resolveError(error: string) {
  if (!error) return '';
  return errorMessages[error] || errorMessages.default;
}

export function LoginForm({ callbackUrl, initialError = '' }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(resolveError(initialError));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setErrorMessage('');

    const result = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
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

      <form className={styles.devForm} onSubmit={handleSubmit}>
        <label className={styles.fieldLabel}>
          <span>Email</span>
          <input
            className={styles.input}
            type="email"
            placeholder="meno@kaufland.sk"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={submitting}
          />
        </label>

        <label className={styles.fieldLabel}>
          <span>Heslo</span>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={submitting}
          />
        </label>

        <button type="submit" className={styles.devButton} disabled={submitting || !email.trim() || !password}>
          {submitting ? 'Prihlasovanie…' : 'Prihlásiť sa'}
        </button>
      </form>
    </div>
  );
}
