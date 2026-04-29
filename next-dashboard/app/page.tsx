import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { LegacyDashboardHost } from '@/components/legacy-dashboard-host';
import { LegacyIndexShell } from '@/components/legacy-index-shell';

export const metadata: Metadata = {
  title: 'Kaufland PRO Dashboard',
};

type HomePageProps = {
  searchParams?: Promise<{ view?: string | string[]; login?: string | string[] }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : {};
  const viewParam = Array.isArray(params.view) ? params.view[0] : params.view;

  if (viewParam === 'sumar') {
    redirect('/legacy-sumar');
  }

  if (viewParam === 'test') {
    redirect('/test-lab');
  }

  const loginParam = Array.isArray(params.login) ? params.login[0] : params.login;

  return (
    <>
      <LegacyIndexShell initialLogin={loginParam || ''} />
      <LegacyDashboardHost asset="index" bodyMode="scripts-only" />
    </>
  );
}
