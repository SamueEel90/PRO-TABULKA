import { LegacyIndexChrome } from '@/components/legacy-index-chrome';
import { LegacyIndexLoginShell } from '@/components/legacy-index-login-shell';
import { LegacyIndexMain } from '@/components/legacy-index-main';
import { LegacyIndexSidebar } from '@/components/legacy-index-sidebar';

type LegacyIndexShellProps = {
  initialLogin?: string;
};

export function LegacyIndexShell({ initialLogin = '' }: LegacyIndexShellProps) {
  const hasInitialLogin = Boolean(initialLogin.trim());

  return (
    <>
      <LegacyIndexChrome />
      <LegacyIndexLoginShell initialLogin={initialLogin} />

      <section className="app-shell" id="appShell" style={{ display: hasInitialLogin ? 'grid' : undefined }}>
        <LegacyIndexSidebar />
        <LegacyIndexMain />
      </section>
    </>
  );
}