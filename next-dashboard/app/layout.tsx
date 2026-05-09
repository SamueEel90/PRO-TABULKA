import type { Metadata, Viewport } from 'next';

import ThemeDotField from '@/components/theme-dot-field';
import { Providers } from '@/components/providers';

import './globals.css';

export const metadata: Metadata = {
  title: 'PRO Dashboard Next',
  description: 'Next.js verzia PRO dashboardu nad SQL databázou.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sk">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="app-background" aria-hidden="true">
          <ThemeDotField />
        </div>
        <Providers>
          <div className="shell">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
