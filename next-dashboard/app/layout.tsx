import type { Metadata } from 'next';

import DotField from '@/components/dot-field';

import './globals.css';

export const metadata: Metadata = {
  title: 'PRO Dashboard Next',
  description: 'Next.js verzia PRO dashboardu nad SQL databázou.',
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
          <DotField
            className="app-background__dots"
            dotRadius={1.5}
            dotSpacing={14}
            bulgeStrength={67}
            glowRadius={160}
            sparkle={false}
            waveAmplitude={0}
            cursorRadius={500}
            cursorForce={0.1}
            bulgeOnly
            gradientFrom="#154c79"
            gradientTo="#207e77"
            glowColor="#12212e"
          />
        </div>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
