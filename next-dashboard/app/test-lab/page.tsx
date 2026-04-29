import type { Metadata } from 'next';

import { LegacyDashboardHost } from '@/components/legacy-dashboard-host';

export const metadata: Metadata = {
  title: 'PRO Test Lab',
};

export default function TestLabPage() {
  return <LegacyDashboardHost asset="test" />;
}