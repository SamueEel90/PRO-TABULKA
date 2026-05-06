import { redirect } from 'next/navigation';

import { auth } from '@/auth';

import { LoginForm } from './login-form';
import styles from './login.module.css';

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth();
  if (session?.user) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const error = typeof params.error === 'string' ? params.error : '';
  const callbackUrl = typeof params.callbackUrl === 'string' ? params.callbackUrl : '/dashboard';

  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID);
  const devLoginEnabled =
    process.env.DEV_LOGIN_ENABLED === 'true' || process.env.NODE_ENV !== 'production';

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.brandLogo}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/6/65/Kaufland_Deutschland.png" alt="Kaufland logo" />
            </span>
            <span className={styles.brandText}>KAUFLAND PRO GJ 2026</span>
          </div>
          <h1 className={styles.title}>PRO GJ 2026.</h1>
          <p className={styles.subtitle}>Dashboard vývoja 2026.</p>
        </header>

        <LoginForm
          callbackUrl={callbackUrl}
          googleEnabled={googleEnabled}
          devLoginEnabled={devLoginEnabled}
          initialError={error}
        />
      </section>
    </main>
  );
}
