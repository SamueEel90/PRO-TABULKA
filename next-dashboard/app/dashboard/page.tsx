import type { Metadata } from 'next';

import { LegacyDashboardHost } from '@/components/legacy-dashboard-host';
import { LegacyIndexShell } from '@/components/legacy-index-shell';

import '../dashboard.css';

export const metadata: Metadata = {
  title: 'Kaufland PRO Dashboard GJ 2026',
};

type DashboardPageProps = {
  searchParams?: Promise<{ login?: string | string[]; [key: string]: string | string[] | undefined }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = searchParams ? await searchParams : {};
  const login = Array.isArray(params.login) ? (params.login[0] ?? '') : (params.login ?? '');

  return (
    <>
      <LegacyIndexShell initialLogin={login} />
      <LegacyDashboardHost asset="index" bodyMode="scripts-only" />
    </>
  );
}
