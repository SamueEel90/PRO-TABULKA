import { MetricLayoutPanel } from './metric-layout-panel';
import { SessionIndicator } from './session-indicator';

export function LegacyIndexSidebar() {
  return (
    <>
      <button className="shell-menu-button" id="menuToggleButton" type="button" aria-controls="topBar" aria-expanded="false">
        <span className="shell-menu-icon" aria-hidden="true"><span /><span /><span /></span>
        <span>Menu</span>
      </button>
      <div className="shell-utility-bar" aria-label="Rýchle akcie dashboardu">
        <button className="shell-utility-button" id="scopeNotesButton" type="button" aria-label="Otvoriť poznámky" title="Poznámky">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3.5h6l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5z" /><path d="M14 3.5V8h4" /><path d="M9 11h6" /><path d="M9 14.5h6" /></svg>
          <span className="shell-utility-badge" id="scopeNotesIndicator" aria-hidden="true" />
        </button>
        <button className="shell-utility-button js-theme-mode-toggle" type="button" role="switch" aria-checked="false" aria-label="Prepnúť tmavý mód" title="Prepnúť vzhľad" data-theme-toggle="mode" data-theme-mode="light">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2" /><path d="M12 19.3v2.2" /><path d="M21.5 12h-2.2" /><path d="M4.7 12H2.5" /><path d="M18.7 5.3l-1.6 1.6" /><path d="M6.9 17.1l-1.6 1.6" /><path d="M18.7 18.7l-1.6-1.6" /><path d="M6.9 6.9L5.3 5.3" /></svg>
        </button>
      </div>
      <div className="sidebar-backdrop hidden" id="sidebarBackdrop" />
      <aside className="sidebar" id="topBar">
        <div className="sidebar-topline">
          <button className="secondary-btn topbar-toggle" id="topbarToggle" type="button" aria-label="Zavrieť menu">&times;</button>
          <div className="brand-mark">
            <div className="brand-square"><img src="https://upload.wikimedia.org/wikipedia/commons/6/65/Kaufland_Deutschland.png" alt="Kaufland logo" /></div>
            <div className="brand-title">
              <span>Pro GJ 2026</span>
              <span>Kaufland</span>
            </div>
          </div>
        </div>

        <div className="sidebar-content" id="topbarContent">
          <div className="side-card">
            <h3>Prihlásený používateľ</h3>
            <SessionIndicator />
            {/* Legacy slots — still populated by inline scripts for compatibility */}
            <div className="identity-name" id="identityName" hidden />
            <div className="identity-meta" id="identityMeta" hidden />
          </div>

          <div className="side-card">
            <h3>Filtre</h3>
            <label>
              <div className="field-label">Výber filiálky</div>
              <select className="scope-select" id="scopeSelect" />
            </label>
            <label style={{ marginTop: 6, display: 'block' }}>
              <div className="field-label">Výber mesiaca</div>
              <select className="scope-select" id="monthSelect" />
            </label>
            <label style={{ marginTop: 6, display: 'block' }}>
              <div className="field-label">Ukazovateľ</div>
              <select className="scope-select" id="metricSelect" />
            </label>
            <div className="side-list" id="scopeSummary" hidden />
          </div>

          <div hidden aria-hidden="true">
            <div id="metricTableTitle" />
            <div id="metricTableModeMeta" />
          </div>

          <div className="side-card">

            <div className="table-toolbar">
<div className="table-toolbar-actions">
                <div className="table-toolbar-group table-toolbar-group--primary">
                  <div className="table-toolbar-group-label">Typ zobrazenia</div>
                  <div className="chart-mode-tabs table-view-tabs" id="tableViewControls" />
                </div>
                <div className="table-toolbar-group table-toolbar-group--filters">
                  <div className="table-toolbar-group-label">Výber riadkov</div>
                  <div className="chart-mode-tabs table-row-visibility-tabs" id="rowVisibilityControls" />
                </div>
                <div className="table-toolbar-group table-toolbar-group--actions">
                  
                  <div className="table-toolbar-bulk-actions">
                    <button className="secondary-btn" id="collapseAllMetricsButton" type="button">Zbaliť všetko</button>
                    <button className="secondary-btn" id="expandAllMetricsButton" type="button">Rozbaliť všetko</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <MetricLayoutPanel />

          <div hidden aria-hidden="true">
            <button id="refreshButton" type="button" />
            <button id="saveButton" type="button" />
            <div id="saveHint" />
          </div>
        </div>
      </aside>
    </>
  );
}