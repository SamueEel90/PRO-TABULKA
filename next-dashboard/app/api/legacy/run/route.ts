import { NextResponse } from 'next/server';

import { ensureCacheFreshForRequest, setAfterSaveCookie } from '@/lib/db/client';
import {
  getDashboardDataFromSql,
  getSummaryDataFromSql,
  getScopeNotesFromSql,
  getWeeklyVodOverridesFromSql,
  saveDashboardChangesToSql,
} from '@/lib/legacy/dashboard-service';

export async function POST(request: Request) {
  try {
    const { method, args } = await request.json() as { method?: string; args?: unknown[] };
    const params = Array.isArray(args) ? args : [];
    const methodName = String(method || '');

    // Reads honor the just-saved cookie (forces re-validate vs Sheets to break
    // cross-lambda cache divergence after a save). Writes always push fresh.
    await ensureCacheFreshForRequest(request);

    // Middleware injects x-user-email from the JWT session — use it as fallback
    // when the legacy HTML doesn't pass a loginValue in the request body.
    const sessionEmail = decodeURIComponent(request.headers.get('x-user-email') || '');

    const resolveLogin = (raw: string) => raw || sessionEmail;

    const reply = (body: unknown, opts?: { setAfterSaveCookie?: boolean }): NextResponse => {
      const res = NextResponse.json(body);
      if (opts?.setAfterSaveCookie) {
        setAfterSaveCookie(res);
      }
      return res;
    };

    switch (methodName) {
      case 'getWebAppUrl':
        return reply({ ok: true, result: request.headers.get('origin') || new URL(request.url).origin + '/' });
      case 'getDashboardData':
        return reply({ ok: true, result: await getDashboardDataFromSql(resolveLogin(String(params[0] || '')), String(params[1] || 'ALL')) });
      case 'getSummaryData':
        return reply({ ok: true, result: await getSummaryDataFromSql(resolveLogin(String(params[0] || ''))) });
      case 'getWeeklyVodOverrides':
        return reply({ ok: true, result: await getWeeklyVodOverridesFromSql(resolveLogin(String(params[0] || '')), String(params[1] || 'ALL'), String(params[2] || '')) });
      case 'getScopeNotes':
        return reply({ ok: true, result: await getScopeNotesFromSql(resolveLogin(String(params[0] || '')), String(params[1] || 'ALL'), String(params[2] || 'scope'), String(params[3] || '')) });
      case 'saveDashboardChanges':
        return reply(
          {
            ok: true,
            result: await saveDashboardChangesToSql(
              resolveLogin(String(params[0] || '')),
              String(params[1] || 'ALL'),
              Array.isArray(params[2]) ? params[2] as Array<{ metric: string; month: string; value: number }> : [],
              Array.isArray(params[3]) ? params[3] as Array<{ metric: string; text: string; noteScopeMode?: string }> : [],
              Array.isArray(params[4]) ? params[4] as Array<{ metric: string; month: string; weekIndex: number; weekLabel?: string; rangeLabel?: string; value: number; distributionMode?: string }> : [],
              String(params[5] || 'scope'),
            ),
          },
          { setAfterSaveCookie: true },
        );
      case 'createSummaryCache':
        return reply({ ok: true, result: { ok: true } });
      default:
        return NextResponse.json({ ok: false, error: `Nepodporovaná legacy metóda: ${methodName}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Legacy volanie zlyhalo.' }, { status: 500 });
  }
}