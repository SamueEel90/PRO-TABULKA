import type { Metadata } from 'next';

import { AutoLoginTrigger } from '@/components/auto-login-trigger';
import { LegacyDashboardHost } from '@/components/legacy-dashboard-host';
import { LegacyIndexShell } from '@/components/legacy-index-shell';

import '../../dashboard.css';

export const metadata: Metadata = {
  title: 'Kaufland PRO Dashboard GJ 2026',
};

type StorePageProps = {
  params: Promise<{ storeId: string }>;
};

export default async function StoreDashboardPage({ params }: StorePageProps) {
  const { storeId } = await params;

  return (
    <>
      <AutoLoginTrigger />
      <LegacyIndexShell initialLogin={storeId} />
      <LegacyDashboardHost asset="index" bodyMode="scripts-only" />
    </>
  );
}
