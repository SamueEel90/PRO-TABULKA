'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

export function LegacyIndexAdminLink() {
  const { data: session } = useSession();

  if (session?.user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <Link href="/upload" className="primary-btn login-admin-link">
      Admin upload
    </Link>
  );
}
