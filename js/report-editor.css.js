/* ============================================================================
   MB Report Editor - CSS
   ============================================================================
   Alle styling voor de editor-chrome (toolbar, panelen, hover/selectie-
   outlines, resize-handles, hulplijnen, mini-toolbar, modals, waarschuwing).

   Naming-namespace: alles begint met .mb- om conflicten met de bestaande
   rapport-CSS te vermijden. Gebruikt de bestaande huisstijl CSS custom
   properties (--blue, --blue-deep, --orange, --green, --amber, --red) waar
   mogelijk, met veilige fallback-waarden voor het geval deze properties
   (nog) niet gedefinieerd zijn in de host-pagina (bijv. bij losstaand
   testen van dit bestand).
   ============================================================================ */

:root {
  /* Fallbacks — worden overschreven door de bestaande :root van de hoofdapp
     zodra dit bestand daar wordt ingeplugd. Alleen actief als er nog geen
     eigen custom properties met deze naam bestaan (CSS cascade beslist). */
  --mb-blue: var(--blue, #1d5fae);
  --mb-blue-deep: var(--blue-deep, #123b73);
  --mb-orange: var(--orange, #e07a1f);
  --mb-green: var(--green, #2f9e52);
  --mb-amber: var(--amber, #d69e00);
  --mb-red: var(--red, #c0392b);

  --mb-panel-bg: #ffffff;
  --mb-panel-border: #dfe3e8;
  --mb-toolbar-bg: #f4f6f8;
  --mb-text: #1f2933;
  --mb-text-muted: #5a6672;
  --mb-shadow: 0 2px 10px rgba(15, 30, 60, 0.12);
}

/* ----------------------------------------------------------------------
   Algemeen
   ---------------------------------------------------------------------- */

.mb-editor-toolbar,
.mb-page-nav,
.mb-editor-panel,
.mb-validation-panel,
.mb-modal-overlay,
.mb-mini-toolbar,
.mb-toast-host {
  font-family: "DM Sans", Arial, Helvetica, sans-serif;
  box-sizing: border-box;
  color: var(--mb-text);
}
.mb-editor-toolbar *,
.mb-page-nav *,
.mb-editor-panel *,
.mb-validation-panel *,
.mb-modal-overlay *,
.mb-mini-toolbar * {
  box-sizing: border-box;
}

/* geeft ruimte bovenin het scherm voor de vaste toolbar zodat de eerste
   A4-pagina er niet onder verdwijnt */
body.mb-editor-active {
  padding-top: 52px;
}

/* ----------------------------------------------------------------------
   Toolbar (boven, buiten de A4-pagina's — print nooit mee)
   ---------------------------------------------------------------------- */

.mb-editor-toolbar {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 9000;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  padding: 8px 16px;
  background: var(--mb-toolbar-bg);
  border-bottom: 1px solid var(--mb-panel-border);
  box-shadow: var(--mb-shadow);
}

.mb-toolbar-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.mb-toolbar-group-right {
  margin-left: auto;
}

.mb-btn {
  font: inherit;
  font-size: 13px;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--mb-panel-border);
  background: #ffffff;
  color: var(--mb-text);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  white-space: nowrap;
}
.mb-btn:hover {
  background: #eef3fa;
  border-color: var(--mb-blue);
}
.mb-btn:active {
  background: #e2ecf9;
}
.mb-btn-small {
  padding: 4px 8px;
  font-size: 12px;
}
.mb-btn-block {
  display: block;
  width: 100%;
  text-align: center;
  margin-bottom: 8px;
  background: var(--mb-blue);
  border-color: var(--mb-blue-deep);
  color: #ffffff;
}
.mb-btn-block:hover {
  background: var(--mb-blue-deep);
}

#mbBtn-editReport {
  background: var(--mb-blue);
  border-color: var(--mb-blue-deep);
  color: #ffffff;
  font-weight: 600;
}
#mbBtn-editReport:hover {
  background: var(--mb-blue-deep);
}

.mb-mode-tabs {
  display: flex;
  border: 1px solid var(--mb-panel-border);
  border-radius: 6px;
  overflow: hidden;
}
.mb-mode-tab {
  font: inherit;
  font-size: 12px;
  padding: 6px 10px;
  background: #ffffff;
  border: none;
  border-right: 1px solid var(--mb-panel-border);
  cursor: pointer;
  color: var(--mb-text-muted);
}
.mb-mode-tab:last-child { border-right: none; }
.mb-mode-tab-active {
  background: var(--mb-blue);
  color: #ffffff;
  font-weight: 600;
}

.mb-grid-setting,
.mb-snap-setting {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--mb-text-muted);
  white-space: nowrap;
}
.mb-grid-setting input[type="number"] {
  width: 52px;
  padding: 3px 5px;
  border: 1px solid var(--mb-panel-border);
  border-radius: 4px;
}

/* ----------------------------------------------------------------------
   Paginanavigator (links)
   ---------------------------------------------------------------------- */

.mb-page-nav {
  position: fixed;
  top: 52px;
  left: 0;
  bottom: 0;
  width: 150px;
  overflow-y: auto;
  background: var(--mb-panel-bg);
  border-right: 1px solid var(--mb-panel-border);
  z-index: 8000;
  padding: 10px;
}
.mb-page-nav-title {
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 8px;
  color: var(--mb-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.mb-page-nav-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mb-page-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--mb-panel-border);
  border-radius: 6px;
  cursor: pointer;
  background: #fafbfc;
  font-size: 12px;
}
.mb-page-card:hover {
  border-color: var(--mb-blue);
  background: #eef3fa;
}
.mb-page-card-active {
  border-color: var(--mb-blue);
  background: #dfeaf9;
}
.mb-page-card-num {
  flex: 0 0 auto;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: var(--mb-blue);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.mb-page-card-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--mb-text-muted);
}

/* ----------------------------------------------------------------------
   Eigenschappenpaneel (rechts)
   ---------------------------------------------------------------------- */

.mb-editor-panel {
  position: fixed;
  top: 52px;
  right: 0;
  bottom: 0;
  width: 280px;
  overflow-y: auto;
  background: var(--mb-panel-bg);
  border-left: 1px solid var(--mb-panel-border);
  z-index: 8000;
  padding: 14px;
}
.mb-panel-empty {
  color: var(--mb-text-muted);
  font-size: 13px;
  padding: 20px 4px;
  text-align: center;
}
.mb-panel-header {
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--mb-panel-border);
}
.mb-panel-field-id {
  font-size: 11px;
  font-family: monospace;
  color: var(--mb-text-muted);
  word-break: break-all;
}
.mb-panel-field-type {
  font-size: 11px;
  color: var(--mb-blue);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-top: 2px;
}
.mb-panel-section {
  margin-bottom: 16px;
}
.mb-panel-section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--mb-text-muted);
  margin-bottom: 8px;
}
.mb-panel-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
}
.mb-panel-row label {
  flex: 1 1 auto;
  color: var(--mb-text);
}
.mb-panel-hint {
  font-size: 11px;
  color: var(--mb-text-muted);
  font-style: italic;
  margin-bottom: 8px;
}
.mb-input,
.mb-textarea {
  width: 130px;
  padding: 4px 6px;
  border: 1px solid var(--mb-panel-border);
  border-radius: 4px;
  font: inherit;
  font-size: 12px;
}
.mb-textarea {
  width: 100%;
  resize: vertical;
}
.mb-input-color {
  width: 40px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--mb-panel-border);
  border-radius: 4px;
  cursor: pointer;
}
.mb-panel-actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

/* ----------------------------------------------------------------------
   Hover / selectie op rapportelementen
   ---------------------------------------------------------------------- */

.mb-hover {
  outline: 1px dashed var(--mb-blue) !important;
  outline-offset: 2px;
  cursor: pointer;
}
.mb-selected {
  outline: 2px solid var(--mb-blue) !important;
  outline-offset: 2px;
}
.mb-editing {
  outline: 2px solid var(--mb-green) !important;
  outline-offset: 2px;
  background: rgba(47, 158, 82, 0.05);
}
.mb-out-of-bounds {
  outline: 2px solid var(--mb-red) !important;
  box-shadow: 0 0 0 4px rgba(192, 57, 43, 0.15) !important;
}

/* de dichtstbijzijnde A4-pagina van een losgemaakt kind-element moet
   position:relative krijgen zodat absolute coördinaten kloppen */
.mb-positioning-context {
  position: relative !important;
}

/* ----------------------------------------------------------------------
   Drag-handle en resize-handles
   ---------------------------------------------------------------------- */

.mb-drag-handle {
  position: absolute;
  top: -14px;
  left: -14px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--mb-blue);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  cursor: move;
  z-index: 9500;
  box-shadow: var(--mb-shadow);
  user-select: none;
}

.mb-handle {
  position: absolute;
  width: 9px;
  height: 9px;
  background: #ffffff;
  border: 2px solid var(--mb-blue);
  border-radius: 2px;
  z-index: 9500;
}
.mb-handle-n  { top: -5px; left: 50%; margin-left: -4.5px; cursor: n-resize; }
.mb-handle-s  { bottom: -5px; left: 50%; margin-left: -4.5px; cursor: s-resize; }
.mb-handle-e  { right: -5px; top: 50%; margin-top: -4.5px; cursor: e-resize; }
.mb-handle-w  { left: -5px; top: 50%; margin-top: -4.5px; cursor: w-resize; }
.mb-handle-ne { top: -5px; right: -5px; cursor: ne-resize; }
.mb-handle-nw { top: -5px; left: -5px; cursor: nw-resize; }
.mb-handle-se { bottom: -5px; right: -5px; cursor: se-resize; }
.mb-handle-sw { bottom: -5px; left: -5px; cursor: sw-resize; }

/* ----------------------------------------------------------------------
   Hulplijnen (snap-guides) tijdens slepen
   ---------------------------------------------------------------------- */

.mb-guide {
  position: fixed;
  background: var(--mb-orange);
  z-index: 9400;
  pointer-events: none;
}
.mb-guide-v { width: 1px; }
.mb-guide-h { height: 1px; }

/* ----------------------------------------------------------------------
   Mini-toolbar bij inline tekstbewerking
   ---------------------------------------------------------------------- */

.mb-mini-toolbar {
  position: fixed;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  background: #ffffff;
  border: 1px solid var(--mb-panel-border);
  border-radius: 6px;
  box-shadow: var(--mb-shadow);
  z-index: 9600;
}
.mb-mini-toolbar button {
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  width: 24px;
  height: 24px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
}
.mb-mini-toolbar button:hover {
  background: #eef3fa;
  border-color: var(--mb-blue);
}
.mb-mini-toolbar input[type="color"] {
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  cursor: pointer;
}

/* ----------------------------------------------------------------------
   Waarschuwingslabel bij tekstoverflow
   ---------------------------------------------------------------------- */

.mb-overflow-warning {
  display: block;
  font-size: 10px;
  color: #ffffff;
  background: var(--mb-red);
  padding: 2px 6px;
  border-radius: 3px;
  margin-top: 2px;
  width: fit-content;
}

/* ----------------------------------------------------------------------
   Validatiepaneel
   ---------------------------------------------------------------------- */

.mb-validation-panel {
  position: fixed;
  bottom: 20px;
  right: 300px;
  width: 340px;
  max-height: 60vh;
  overflow-y: auto;
  background: var(--mb-panel-bg);
  border: 1px solid var(--mb-panel-border);
  border-radius: 8px;
  box-shadow: var(--mb-shadow);
  z-index: 9200;
}
.mb-validation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--mb-panel-border);
  position: sticky;
  top: 0;
  background: var(--mb-panel-bg);
}
.mb-validation-title {
  font-weight: 700;
  font-size: 13px;
}
.mb-validation-list {
  padding: 8px 12px;
}
.mb-validation-empty {
  color: var(--mb-text-muted);
  font-size: 12px;
  padding: 10px 0;
}
.mb-validation-group {
  margin-bottom: 10px;
}
.mb-validation-group-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--mb-text-muted);
  margin-bottom: 4px;
}
.mb-validation-item {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  font-size: 12px;
  padding: 4px 6px;
  border-radius: 4px;
  margin-bottom: 4px;
}
.mb-severity-error {
  background: rgba(192, 57, 43, 0.10);
  border-left: 3px solid var(--mb-red);
}
.mb-severity-warning {
  background: rgba(214, 158, 0, 0.12);
  border-left: 3px solid var(--mb-amber);
}
.mb-severity-info {
  background: rgba(29, 95, 174, 0.08);
  border-left: 3px solid var(--mb-blue);
}
.mb-validation-code {
  font-family: monospace;
  font-size: 10px;
  color: var(--mb-text-muted);
  flex: 0 0 auto;
}

/* ----------------------------------------------------------------------
   Modals (PDF-voorbeeld, sjabloonbeheer)
   ---------------------------------------------------------------------- */

.mb-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 25, 40, 0.55);
  z-index: 9700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mb-modal {
  background: #ffffff;
  border-radius: 10px;
  box-shadow: var(--mb-shadow);
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.mb-modal-large {
  width: 900px;
  height: 85vh;
}
.mb-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--mb-panel-border);
}
.mb-modal-title {
  font-weight: 700;
  font-size: 15px;
}
.mb-modal-note {
  padding: 6px 16px;
  font-size: 11px;
  color: var(--mb-text-muted);
  font-style: italic;
}
.mb-modal-iframe-wrap {
  flex: 1 1 auto;
  overflow: auto;
  background: #ececec;
  padding: 12px;
}
.mb-pdf-preview-frame {
  width: 100%;
  height: 100%;
  min-height: 600px;
  border: none;
  background: #ffffff;
}

/* sjabloonbeheer-tabel (gebruikt door template-manager.js) */
.mb-modal-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 12px 16px;
}
.mb-template-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.mb-template-table th,
.mb-template-table td {
  text-align: left;
  padding: 8px 6px;
  border-bottom: 1px solid var(--mb-panel-border);
}
.mb-template-table th {
  color: var(--mb-text-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.mb-template-actions {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.mb-template-json-preview {
  max-height: 300px;
  overflow: auto;
  background: #f4f6f8;
  border: 1px solid var(--mb-panel-border);
  border-radius: 6px;
  padding: 10px;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-word;
}
.mb-template-empty {
  color: var(--mb-text-muted);
  font-size: 13px;
  padding: 20px 0;
  text-align: center;
}
.mb-template-error {
  color: var(--mb-red);
  font-size: 12px;
  margin-top: 6px;
}

/* ----------------------------------------------------------------------
   Toasts
   ---------------------------------------------------------------------- */

.mb-toast-host {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}
.mb-toast {
  padding: 8px 16px;
  border-radius: 6px;
  background: var(--mb-blue-deep);
  color: #ffffff;
  font-size: 13px;
  box-shadow: var(--mb-shadow);
  opacity: 1;
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.mb-toast-success { background: var(--mb-green); }
.mb-toast-warning { background: var(--mb-amber); color: #3a2c00; }
.mb-toast-error { background: var(--mb-red); }
.mb-toast-out {
  opacity: 0;
  transform: translateY(6px);
}

/* ----------------------------------------------------------------------
   Print: editor-chrome mag NOOIT meeprinten, ook niet per ongeluk
   ---------------------------------------------------------------------- */

@media print {
  .mb-editor-toolbar,
  .mb-editor-panel,
  .mb-page-nav,
  .mb-hover,
  .mb-selected,
  .mb-handle,
  .mb-guide,
  .mb-overflow-warning,
  .mb-drag-handle,
  .mb-mini-toolbar,
  .mb-validation-panel,
  .mb-modal-overlay,
  .mb-toast-host {
    display: none !important;
  }
}
