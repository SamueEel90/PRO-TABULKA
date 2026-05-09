import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';

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
    redirect('/sumar');
  }

  // GL has no access to filiálkový dashboard — go straight to sumar.
  const session = await auth();
  if (session?.user?.role === 'GL') {
    redirect('/sumar');
  }

  const redirectParams = new URLSearchParams();
  Object.entries(params).forEach(([key, rawValue]) => {
    if (Array.isArray(rawValue)) {
      rawValue.forEach((value) => {
        if (value != null && value !== '') {
          redirectParams.append(key, value);
        }
      });
      return;
    }

    if (rawValue != null && rawValue !== '') {
      redirectParams.set(key, rawValue);
    }
  });

  const redirectTarget = redirectParams.size
    ? `/dashboard?${redirectParams.toString()}`
    : '/dashboard';

  redirect(redirectTarget as Parameters<typeof redirect>[0]);
}
