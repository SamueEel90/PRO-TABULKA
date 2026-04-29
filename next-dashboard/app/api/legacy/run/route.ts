import { NextResponse } from 'next/server';

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

    switch (String(method || '')) {
      case 'getWebAppUrl':
        return NextResponse.json({ ok: true, result: request.headers.get('origin') || new URL(request.url).origin + '/' });
      case 'getDashboardData':
        return NextResponse.json({ ok: true, result: await getDashboardDataFromSql(String(params[0] || ''), String(params[1] || 'ALL')) });
      case 'getSummaryData':
        return NextResponse.json({ ok: true, result: await getSummaryDataFromSql(String(params[0] || '')) });
      case 'getWeeklyVodOverrides':
        return NextResponse.json({ ok: true, result: await getWeeklyVodOverridesFromSql(String(params[0] || ''), String(params[1] || 'ALL'), String(params[2] || '')) });
      case 'getScopeNotes':
        return NextResponse.json({ ok: true, result: await getScopeNotesFromSql(String(params[0] || ''), String(params[1] || 'ALL'), String(params[2] || 'scope'), String(params[3] || '')) });
      case 'saveDashboardChanges':
        return NextResponse.json({
          ok: true,
          result: await saveDashboardChangesToSql(
            String(params[0] || ''),
            String(params[1] || 'ALL'),
            Array.isArray(params[2]) ? params[2] as Array<{ metric: string; month: string; value: number }> : [],
            Array.isArray(params[3]) ? params[3] as Array<{ metric: string; text: string }> : [],
            Array.isArray(params[4]) ? params[4] as Array<{ metric: string; month: string; weekIndex: number; weekLabel?: string; rangeLabel?: string; value: number; distributionMode?: string }> : [],
            String(params[5] || 'scope'),
          ),
        });
      case 'createSummaryCache':
        return NextResponse.json({ ok: true, result: { ok: true } });
      default:
        return NextResponse.json({ ok: false, error: `Nepodporovaná legacy metóda: ${String(method || '')}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Legacy volanie zlyhalo.' }, { status: 500 });
  }
}