import { IndexDashboardChartSection } from '@/components/index-dashboard-chart-section';
import { IndexDashboardMonthlyTable } from '@/components/index-dashboard-monthly-table';
import { OverviewStrip } from '@/components/overview-strip';

export function LegacyIndexMain() {
  return (
    <main className="main">
      <section className="hero-panel">
        <div className="hero-top">
          <div className="hero-copy">
            <div className="hero-headline">
              <div className="hero-brand-pill" role="img" aria-label="Kaufland PRO GJ 2026">
                <span className="hero-brand-pill-logo">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/6/65/Kaufland_Deutschland.png" alt="" />
                </span>
                <span className="hero-brand-pill-text">KAUFLAND PRO GJ 2026</span>
              </div>
              <h2 id="heroTitle">Ročný riadiaci dashboard</h2>
            </div>
            <p id="heroText" />
            <div className="status-bar">
              <div className="status-chip" id="generatedAt" />
              <div className="status-chip" id="statusScope" />
            </div>
          </div>
          <OverviewStrip />
        </div>
        <div className="hero-grid" id="heroGrid" />
      </section>

      <IndexDashboardChartSection />

      <section className="metric-table">
        <IndexDashboardMonthlyTable />
      </section>
    </main>
  );
}