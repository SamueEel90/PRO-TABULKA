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
          <span className={styles.kicker}>PRO Dashboard</span>
          <h1 className={styles.title}>Prihlásenie</h1>
          <p className={styles.subtitle}>Prihláste sa svojím firemným účtom Kaufland.</p>
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
