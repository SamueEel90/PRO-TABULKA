import { IndexDashboardChartSection } from '@/components/index-dashboard-chart-section';
import { IndexDashboardMonthlyTable } from '@/components/index-dashboard-monthly-table';

export function LegacyIndexMain() {
  return (
    <main className="main">
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="panel-title">Pro GJ 2026</div>
          <h2 id="heroTitle">Ročný riadiaci dashboard</h2>
          <p id="heroText" />
          <div className="status-bar">
            <div className="status-chip" id="generatedAt" />
            <div className="status-chip" id="statusScope" />
          </div>
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