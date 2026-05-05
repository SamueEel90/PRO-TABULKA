export function LegacyIndexChrome() {
  return (
    <>
      <div className="dotfield-backdrop" aria-hidden="true">
        <canvas className="dotfield-canvas" id="dotFieldCanvas" />
      </div>
      <div className="activity-bar hidden" id="activityBar">
        <span />
      </div>
      <div className="app-loader hidden" id="appLoader" aria-live="polite" aria-busy="true">
        <div className="loader-card">
          <div className="loader-spinner" />
          <div className="loader-title" id="loaderTitle">Načítavam dashboard</div>
          <div className="loader-subtitle" id="loaderSubtitle">Spracúvam dáta a pripravujem pohľad.</div>
        </div>
      </div>
      <div className="save-status-toast hidden" id="saveStatusToast" aria-live="polite" />
      <div className="fab-tray" id="fabTray">
        <button className="recalc-fab save-fab hidden" id="saveFabButton" type="button">Uložiť zmeny</button>
        <button className="recalc-fab hidden" id="recalcButton" type="button">Prepočítať</button>
        <button className="fab-collapse-toggle" id="fabCollapseToggle" type="button" aria-label="Skryť tlačidlá" />
      </div>

      <div className="note-modal-backdrop hidden" id="noteModalBackdrop">
        <div className="note-modal" role="dialog" aria-modal="true" aria-labelledby="noteModalTitle">
          <div className="note-modal-header">
            <div>
              <div className="panel-title">Spoločné poznámky</div>
              <div className="note-modal-title" id="noteModalTitle" />
              <div className="support-text" id="noteModalMeta" />
            </div>
            <div className="action-row">
              <button className="secondary-btn" id="noteModalClose" type="button">Zavrieť</button>
              <button className="primary-btn" id="noteModalSave" type="button">Uložiť zmeny</button>
            </div>
          </div>
          <div className="note-modal-grid" id="noteModalContent" />
        </div>
      </div>
    </>
  );
}