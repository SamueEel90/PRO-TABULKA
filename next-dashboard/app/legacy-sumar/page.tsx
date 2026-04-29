import type { Metadata } from 'next';

import { LegacyDashboardHost } from '@/components/legacy-dashboard-host';

export const metadata: Metadata = {
  title: 'SUMAR PRO GJ2026',
};

export default function LegacySummaryPage() {
  return <LegacyDashboardHost asset="sumar" />;
}