import Link from 'next/link';

import { BarChart, Sparkline } from '@/components/plan-charts';
import { formatCompactMetricValue, formatMetricValue, getPlanDashboardSnapshot } from '@/lib/plan-dashboard';

export const dynamic = 'force-dynamic';

export default async function SummaryPage() {
  const snapshot = await getPlanDashboardSnapshot();
  const [turnoverMetric, hoursMetric, performanceMetric, structureMetric] = snapshot.featuredMetrics;

  return (
    <main className="page page--summary">
      <div className="topbar topbar--dashboard">
        <div className="brand brand--hero">
          <span className="kicker">PRO Sumár GJ2026</span>
          <h1>Executive sumár plánu</h1>
          <p>
            Vrcholový pohľad nad plánom od {snapshot.firstMonthLabel} do {snapshot.lastMonthLabel}. Dnes bez IST a VOD vrstvy,
            čisto na rýchle zhodnotenie ročného plánovacieho obrazu.
          </p>
        </div>
        <div className="actions">
          <Link className="link-button" href="/">
            Index dashboard
          </Link>
          <Link className="link-button" href="/upload">
            Upload centrum
          </Link>
        </div>
      </div>

      <section className="summary-hero panel">
        <div className="summary-hero-copy">
          <div className="summary-badge">Slovensko · Plan-only cockpit</div>
          <h2>Najsilnejší mesiac obratu: {snapshot.bestTurnoverMonth?.label || 'bez dát'}</h2>
          <p>
            Celý sumár je dnes postavený na importovanom sheete PLANGJ2026. Keď doplníme IST a VOD importy,
            tento pohľad sa rozšíri o odchýlky, forecast a manažérske rozhodovanie.
          </p>
        </div>
        <div className="summary-hero-metrics">
          {snapshot.featuredMetrics.slice(0, 4).map((metric) => (
            <article className="summary-stat" key={metric.code}>
              <span className="kicker">{metric.label}</span>
              <strong>{formatCompactMetricValue(metric.annualValue, metric.unit)}</strong>
              <span className="muted">Peak {metric.peakMonth}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="summary-shell-grid">
        <article className="panel chart-story-panel">
          <div className="panel-head">
            <div>
              <span className="kicker">Mesačná trajektória</span>
              <h2>Obrat, hodiny a výkon v čase</h2>
            </div>
            <p className="muted">Čiary a bary sú len nad plánom, takže ukazujú čistý tvar business roka bez reality a zásahov VOD.</p>
          </div>
          <div className="story-grid">
            <div className="story-card story-card--wide">
              <div className="story-card-head">
                <strong>{turnoverMetric.label}</strong>
                <span>{formatMetricValue(turnoverMetric.annualValue, turnoverMetric.unit)}</span>
              </div>
              <Sparkline values={turnoverMetric.monthValues} stroke="#c62828" fill="rgba(198, 40, 40, 0.14)" height={120} />
            </div>
            <div className="story-card">
              <div className="story-card-head">
                <strong>{hoursMetric.label}</strong>
                <span>{formatMetricValue(hoursMetric.annualValue, hoursMetric.unit)}</span>
              </div>
              <BarChart values={hoursMetric.monthValues} labels={snapshot.months.map((month) => month.label)} tone="teal" />
            </div>
            <div className="story-card">
              <div className="story-card-head">
                <strong>{performanceMetric.label}</strong>
                <span>{formatMetricValue(performanceMetric.annualValue, performanceMetric.unit)}</span>
              </div>
              <BarChart values={performanceMetric.monthValues} labels={snapshot.months.map((month) => month.label)} tone="amber" />
            </div>
          </div>
        </article>

        <aside className="panel summary-side-panel">
          <div className="panel-head">
            <div>
              <span className="kicker">Momentky obdobia</span>
              <h2>Čo plán kričí na prvý pohľad</h2>
            </div>
          </div>
          <div className="insight-list">
            <div className="insight-card">
              <span className="kicker">Najvyšší obrat</span>
              <strong>{snapshot.bestTurnoverMonth?.label || 'bez dát'}</strong>
              <p className="muted">{formatMetricValue(snapshot.bestTurnoverMonth?.turnover || 0, 'currency')}</p>
            </div>
            <div className="insight-card">
              <span className="kicker">Najsilnejší výkon</span>
              <strong>{snapshot.strongestPerformanceMonth?.label || 'bez dát'}</strong>
              <p className="muted">{formatMetricValue(snapshot.strongestPerformanceMonth?.performance || 0, 'number')}</p>
            </div>
            <div className="insight-card">
              <span className="kicker">Najvyššia absencia</span>
              <strong>{snapshot.highestAbsenceMonth?.label || 'bez dát'}</strong>
              <p className="muted">{formatMetricValue(snapshot.highestAbsenceMonth?.absence || 0, 'hours')}</p>
            </div>
            <div className="insight-card">
              <span className="kicker">Priemerná štruktúra</span>
              <strong>{formatMetricValue(structureMetric?.annualValue || 0, structureMetric?.unit || 'fte')}</strong>
              <p className="muted">Priemerný plánovaný stav filiálok počas roka.</p>
            </div>
          </div>
        </aside>
      </section>

      <section className="panel journey-panel">
        <div className="panel-head">
          <div>
            <span className="kicker">Mesačná cesta</span>
            <h2>Journey strip business roka</h2>
          </div>
          <p className="muted">Každá karta zobrazuje tri hlavné riadiace veličiny pre konkrétny mesiac.</p>
        </div>
        <div className="journey-strip">
          {snapshot.monthlySummary.map((month) => (
            <article className="month-card" key={month.id}>
              <div className="month-card-head">
                <strong>{month.label}</strong>
                <span className="muted">{month.id}</span>
              </div>
              <div className="month-card-metric">
                <span>Obrat</span>
                <strong>{formatCompactMetricValue(month.turnover, 'currency')}</strong>
              </div>
              <div className="month-card-metric">
                <span>Hodiny</span>
                <strong>{formatMetricValue(month.hours, 'hours')}</strong>
              </div>
              <div className="month-card-metric">
                <span>Čistý výkon</span>
                <strong>{formatMetricValue(month.performance, 'number')}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="summary-shell-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <span className="kicker">TOP predajne</span>
              <h2>Lídri podľa ročného obratu</h2>
            </div>
          </div>
          <div className="store-table">
            {snapshot.topStores.slice(0, 8).map((store) => (
              <div className="store-row" key={store.id}>
                <div>
                  <strong>{store.id}</strong>
                  <p className="muted">{store.name}</p>
                </div>
                <div>
                  <strong>{formatCompactMetricValue(store.turnover, 'currency')}</strong>
                  <p className="muted">Výkon {formatMetricValue(store.performance, 'number')}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <span className="kicker">Tlakové body plánu</span>
              <h2>Silné vedľajšie metriky</h2>
            </div>
          </div>
          <div className="driver-list">
            {snapshot.driverMetrics.map((metric) => (
              <div className="driver-item" key={metric.code}>
                <div>
                  <strong>{metric.label}</strong>
                  <p className="muted">Ročný objem {formatMetricValue(metric.annualValue, metric.unit)}</p>
                </div>
                <div className="driver-sparkline">
                  <Sparkline values={metric.monthValues} stroke="#174a75" fill="rgba(23, 74, 117, 0.12)" height={64} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
