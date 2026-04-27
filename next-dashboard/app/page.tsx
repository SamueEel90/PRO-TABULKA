import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kaufland PRO Dashboard',
};

export default function HomePage() {
  return (
    <main className="legacy-frame-shell">
      <iframe
        className="legacy-frame"
        src="/legacy-index"
        title="Kaufland PRO Dashboard"
      />
    </main>
  );
}
