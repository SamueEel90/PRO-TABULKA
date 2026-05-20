'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

export function DashboardSumarSwitch() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  if (role !== 'VKL' && role !== 'GF') {
    return null;
  }

  return (
    <Link href="/sumar" className="secondary-btn dashboard-sumar-switch" prefetch>
      Sumár
    </Link>
  );
}
