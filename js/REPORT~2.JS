/**
 * ============================================================================
 * MB Report Editor - UI
 * ============================================================================
 * LAADVOLGORDE: dit bestand moet NA report-editor-core.js geladen worden.
 * Het bouwt window.MBEditorUI bovenop window.MBEditor (core). Als
 * window.MBEditor ontbreekt, faalt dit bestand niet bij het laden, maar pas
 * (defensief afgevangen) zodra MBEditorUI.mount() wordt aangeroepen.
 *
 * Verantwoordelijkheden: toolbar-chrome, paginanavigator, eigenschappen-
 * paneel, hover/selectie, inline tekstbewerking, hybride drag/resize-model
 * voor los positioneren, sneltoetsen, validatiepaneel, PDF-voorbeeld/-export,
 * opslaan/herstellen en autosave.
 *
 * ----------------------------------------------------------------------------
 * PUBLIEKE API (window.MBEditorUI)
 * ----------------------------------------------------------------------------
 * mount(stageEl) -> void
 *   Bouwt (idempotent) de editor-chrome rond het gegeven #rptStage-element.
 * unmount() -> void
 *   Verwijdert alle chrome-elementen en event listeners (best effort).
 * refreshPageNav() -> void
 *   Herbouwt de paginanavigator-thumbnails (bijv. na renderReport()).
 * openValidationPanel() -> void
 * closeValidationPanel() -> void
 * openPdfPreview() -> void
 * closePdfPreview() -> void
 * toast(message, kind) -> void   // kind: 'info'|'success'|'warning'|'error'
 * ============================================================================
 */
(function () {
  'use strict';

  // --------------------------------------------------------------------
  // Constanten
  // --------------------------------------------------------------------
  var PAGE_W_MM = 210;
  var PAGE_H_MM = 297;
  var MARGIN_MM = 10;
  var SNAP_THRESHOLD_MM = 3;
  var DEFAULT_GRID_MM = 5;
  var AUTOSAVE_DEBOUNCE_MS = 1500;

  // Interne UI-state (los van MBEditor.state, want dit is puur chrome-status)
  var ui = {
    mounted: false,
    stageEl: null,
    toolbarEl: null,
    midGroupEl: null, // FIX: referentie naar de middengroep-knoppen (opslaan/undo/redo/valideren/pdf) voor selectieve zichtbaarheid
    midGroup2El: null, // FIX: referentie naar de tweede middengroep (herstellen/sjablonen) voor selectieve zichtbaarheid
    rightGroupEl: null, // FIX: referentie naar de rechtergroep (raster/snap/afsluiten) voor selectieve zichtbaarheid
    pageNavEl: null,
    panelEl: null,
    validationEl: null,
    pdfModalEl: null,
    templateModalEl: null,
    gridSize: DEFAULT_GRID_MM,
    snapEnabled: true,
    autosaveTimer: null,
    dragState: null, // actieve drag/resize-sessie
    activeMiniToolbarEl: null,
    guideEls: []
  };

  // --------------------------------------------------------------------
  // Kleine hulpfuncties
  // --------------------------------------------------------------------

  /** Haalt MBEditor defensief op; retourneert null als core (nog) niet geladen is. */
  function core() {
    return (typeof window !== 'undefined' && window.MBEditor) ? window.MBEditor : null;
  }

  function $(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') el.className = attrs[k];
        else if (k === 'text') el.textContent = attrs[k];
        else if (k === 'html') el.innerHTML = attrs[k];
        else el.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      children.forEach(function (c) { if (c) el.appendChild(c); });
    }
    return el;
  }

  /** Simpele toast-melding rechtsonder in beeld. */
  function toast(message, kind) {
    kind = kind || 'info';
    var host = document.getElementById('mbToastHost');
    if (!host) {
      host = $('div', { id: 'mbToastHost', class: 'mb-toast-host' });
      document.body.appendChild(host);
    }
    var el = $('div', { class: 'mb-toast mb-toast-' + kind, text: message });
    host.appendChild(el);
    setTimeout(function () {
      el.classList.add('mb-toast-out');
      setTimeout(function () { el.remove(); }, 300);
    }, 2600);
  }

  /** Geeft de pixel-per-mm-schaal van een paginaelement terug (gemeten via de echte DOM-rect). */
  function getPageScale(pageEl) {
    var rect = pageEl.getBoundingClientRect();
    return {
      pxPerMmX: rect.width / PAGE_W_MM,
      pxPerMmY: rect.height / PAGE_H_MM,
      rect: rect
    };
  }

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  function round1(val) {
    return Math.round(val * 10) / 10;
  }

  // --------------------------------------------------------------------
  // Mount / unmount
  // --------------------------------------------------------------------

  function mount(stageEl) {
    var MB = core();
    if (!MB) {
      console.warn('[MBEditorUI] mount() aangeroepen, maar MBEditor (core) is niet geladen. Laad report-editor-core.js eerst.');
      return;
    }
    stageEl = stageEl || document.getElementById('rptStage');
    if (!stageEl) {
      console.warn('[MBEditorUI] mount(): #rptStage niet gevonden in de DOM.');
      return;
    }
    ui.stageEl = stageEl;

    if (ui.mounted) {
      // al gemount: enkel zichtbaarheid synchroniseren
      syncChromeVisibility();
      return;
    }

    buildToolbar();
    buildPageNav();
    buildPropertiesPanel();
    buildValidationPanel();
    buildPdfModal();
    bindStageEvents();
    bindKeyboardShortcuts();

    ui.mounted = true;
    syncChromeVisibility();
  }

  function unmount() {
    [ui.toolbarEl, ui.pageNavEl, ui.panelEl, ui.validationEl, ui.pdfModalEl].forEach(function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    ui.mounted = false;
  }

  /** Toont/verbergt de editor-chrome op basis van MBEditor.state.active. */
  function syncChromeVisibility() {
    var MB = core();
    var active = !!(MB && MB.state.active);
    // FIX: de toolbar zelf ALTIJD zichtbaar houden zodra gemount. Voorheen
    // werd ui.toolbarEl hier ook verborgen bij active===false, en omdat
    // MBEditor.state.active standaard false is, was de knop "Rapport
    // bewerken" (id mbBtn-editReport) daarmee zelf onzichtbaar — een
    // gebruiker kon de editor dan nooit starten. In plaats daarvan wordt nu
    // alleen de midden-/rechtergroep van de toolbar (Opslaan, Ongedaan
    // maken, Opnieuw uitvoeren, Controleer rapport, Voorbeeld PDF, PDF
    // genereren, Pagina/Rapport herstellen, sjabloonacties, raster/snap,
    // Bewerkmodus afsluiten) verborgen buiten editmodus; de linkergroep
    // ("Rapport bewerken" + modus-tabs) blijft altijd zichtbaar en klikbaar.
    if (ui.toolbarEl) ui.toolbarEl.style.display = '';
    [ui.midGroupEl, ui.midGroup2El, ui.rightGroupEl].forEach(function (el) {
      if (el) el.style.display = active ? '' : 'none';
    });
    [ui.pageNavEl, ui.panelEl].forEach(function (el) {
      if (el) el.style.display = active ? '' : 'none';
    });
    if (!active) {
      closeValidationPanel();
      closePdfPreview();
      clearSelection();
    }
    document.body.classList.toggle('mb-editor-active', active);
  }

  // --------------------------------------------------------------------
  // Toolbar
  // --------------------------------------------------------------------

  function buildToolbar() {
    var tb = $('div', { class: 'mb-editor-toolbar', id: 'mbEditorToolbar' });

    function btn(name, label, title) {
      var b = $('button', {
        id: 'mbBtn-' + name,
        class: 'mb-btn',
        type: 'button',
        title: title || label
      }, []);
      b.textContent = label;
      return b;
    }

    // --- linkerkant: rapport-bewerken toggle + modus-tabs ---
    var editToggle = btn('editReport', 'Rapport bewerken', 'Zet de bewerkmodus van het rapport aan of uit');
    editToggle.addEventListener('click', function () { toggleEditMode(); });

    var modeGroup = $('div', { class: 'mb-mode-tabs', role: 'tablist' });
    var contentTab = $('button', { id: 'mbBtn-modeContent', class: 'mb-mode-tab mb-mode-tab-active', type: 'button', title: 'Inhoud bewerken: tekst, kleuren en uitlijning' });
    contentTab.textContent = 'Inhoud bewerken';
    var designTab = $('button', { id: 'mbBtn-modeDesign', class: 'mb-mode-tab', type: 'button', title: 'Vormgeving bewerken: positie, afmeting en opmaak' });
    designTab.textContent = 'Vormgeving bewerken';
    contentTab.addEventListener('click', function () { setMode('content'); });
    designTab.addEventListener('click', function () { setMode('design'); });
    modeGroup.appendChild(contentTab);
    modeGroup.appendChild(designTab);

    // --- midden: acties ---
    var saveBtn = btn('save', 'Opslaan', 'Sla de huidige bewerkingen op (Ctrl/Cmd+S)');
    saveBtn.addEventListener('click', function () { saveReport(true); });

    var undoBtn = btn('undo', 'Ongedaan maken', 'Maak de laatste wijziging ongedaan (Ctrl/Cmd+Z)');
    undoBtn.addEventListener('click', function () { doUndo(); });

    var redoBtn = btn('redo', 'Opnieuw uitvoeren', 'Voer de ongedaan gemaakte wijziging opnieuw uit (Ctrl/Cmd+Shift+Z)');
    redoBtn.addEventListener('click', function () { doRedo(); });

    var validateBtn = btn('validate', 'Controleer rapport', 'Controleer het rapport op fouten en waarschuwingen');
    validateBtn.addEventListener('click', function () { runValidationPanel(); });

    var previewBtn = btn('pdfPreview', 'Voorbeeld PDF', 'Open een voorbeeld van hoe het rapport eruit komt te zien');
    previewBtn.addEventListener('click', function () { openPdfPreview(); });

    var generateBtn = btn('pdfGenerate', 'PDF genereren', 'Genereer de definitieve PDF van het rapport');
    generateBtn.addEventListener('click', function () { generatePdf(); });

    var restorePageBtn = btn('restorePage', 'Pagina herstellen', 'Verwijder alle bewerkingen op de huidige pagina');
    restorePageBtn.addEventListener('click', function () { restorePage(); });

    var restoreReportBtn = btn('restoreReport', 'Rapport herstellen', 'Verwijder ALLE bewerkingen in dit rapport');
    restoreReportBtn.addEventListener('click', function () { restoreReport(); });

    var saveTemplateBtn = btn('saveTemplate', 'Opslaan als sjabloon', 'Sla de huidige vormgeving op als herbruikbaar sjabloon');
    saveTemplateBtn.addEventListener('click', function () { saveAsTemplateFlow(); });

    var templatesBtn = btn('templates', 'Sjablonen beheren', 'Open het sjablonenbeheer');
    templatesBtn.addEventListener('click', function () {
      if (window.MBTemplateManager && typeof window.MBTemplateManager.open === 'function') {
        window.MBTemplateManager.open();
      } else {
        toast('Sjablonenbeheer is niet geladen.', 'warning');
      }
    });

    var exitBtn = btn('exitEdit', 'Bewerkmodus afsluiten', 'Sluit de bewerkmodus af (rapport blijft opgeslagen)');
    exitBtn.addEventListener('click', function () { exitEditMode(); });

    // --- rechterkant: raster/uitlijn-instellingen ---
    var gridWrap = $('label', { class: 'mb-grid-setting', title: 'Rastergrootte voor het uitlijnen van losse elementen (mm)' });
    gridWrap.textContent = 'Raster (mm): ';
    var gridInput = $('input', { type: 'number', id: 'mbGridSize', min: '1', max: '50', step: '1', value: String(ui.gridSize) });
    gridInput.addEventListener('change', function () {
      var v = parseFloat(gridInput.value);
      ui.gridSize = isNaN(v) || v <= 0 ? DEFAULT_GRID_MM : v;
    });
    gridWrap.appendChild(gridInput);

    var snapWrap = $('label', { class: 'mb-snap-setting', title: 'Zet uitlijnen (snappen) tijdelijk uit tijdens het slepen' });
    var snapCheck = $('input', { type: 'checkbox', id: 'mbSnapDisable' });
    snapCheck.addEventListener('change', function () {
      ui.snapEnabled = !snapCheck.checked;
    });
    snapWrap.appendChild(snapCheck);
    snapWrap.appendChild(document.createTextNode(' Uitlijnen uitschakelen'));

    var leftGroup = $('div', { class: 'mb-toolbar-group' }, [editToggle, modeGroup]);
    var midGroup = $('div', { class: 'mb-toolbar-group' }, [
      saveBtn, undoBtn, redoBtn, validateBtn, previewBtn, generateBtn
    ]);
    var midGroup2 = $('div', { class: 'mb-toolbar-group' }, [
      restorePageBtn, restoreReportBtn, saveTemplateBtn, templatesBtn
    ]);
    var rightGroup = $('div', { class: 'mb-toolbar-group mb-toolbar-group-right' }, [
      gridWrap, snapWrap, exitBtn
    ]);

    tb.appendChild(leftGroup);
    tb.appendChild(midGroup);
    tb.appendChild(midGroup2);
    tb.appendChild(rightGroup);

    document.body.insertBefore(tb, document.body.firstChild);
    ui.toolbarEl = tb;
    // FIX: bewaar de groepen apart zodat syncChromeVisibility() alleen deze
    // kan verbergen buiten editmodus, zonder de hele toolbar (en dus de
    // "Rapport bewerken"-knop) onzichtbaar te maken.
    ui.midGroupEl = midGroup;
    ui.midGroup2El = midGroup2;
    ui.rightGroupEl = rightGroup;
  }

  function toggleEditMode() {
    var MB = core();
    if (!MB) return;
    MB.state.active = !MB.state.active;
    if (MB.state.active) {
      initDossierAndLoad();
    }
    syncChromeVisibility();
  }

  function exitEditMode() {
    var MB = core();
    if (!MB) return;
    MB.state.active = false;
    syncChromeVisibility();
  }

  function setMode(mode) {
    var MB = core();
    if (!MB) return;
    MB.state.mode = mode;
    var contentTab = document.getElementById('mbBtn-modeContent');
    var designTab = document.getElementById('mbBtn-modeDesign');
    if (contentTab && designTab) {
      contentTab.classList.toggle('mb-mode-tab-active', mode === 'content');
      designTab.classList.toggle('mb-mode-tab-active', mode === 'design');
    }
    // eigenschappenpaneel herbouwen voor huidige selectie in de nieuwe modus
    if (MB.state.selection.length === 1) {
      renderPropertiesPanel(MB.state.selection[0]);
    }
  }

  /** Laadt bestaande bewerkdata voor het huidige dossier (indien aanwezig) bij het starten van editmodus. */
  function initDossierAndLoad() {
    var MB = core();
    if (!MB) return;
    var d = (typeof currentData !== 'undefined') ? currentData : null;
    var dossierId = MB.serializer.deriveDossierId(d || {});
    MB.state.dossierId = dossierId;
    var record = MB.serializer.load(dossierId);
    if (record && record.elements) {
      MB.state.overrides = record.elements;
      MB.applyOverridesToDom();
      toast('Eerder opgeslagen bewerkingen geladen.', 'info');
    }
    refreshPageNav();
  }

  // --------------------------------------------------------------------
  // Paginanavigator (links)
  // --------------------------------------------------------------------

  function buildPageNav() {
    var nav = $('div', { class: 'mb-page-nav', id: 'mbPageNav' });
    var title = $('div', { class: 'mb-page-nav-title', text: "Pagina's" });
    nav.appendChild(title);
    var list = $('div', { class: 'mb-page-nav-list', id: 'mbPageNavList' });
    nav.appendChild(list);
    document.body.appendChild(nav);
    ui.pageNavEl = nav;
    refreshPageNav();
  }

  /** Herbouwt de genummerde paginakaartjes. Geen echte thumbnail-rendering in fase 1. */
  function refreshPageNav() {
    if (!ui.pageNavEl || !ui.stageEl) return;
    var list = document.getElementById('mbPageNavList');
    if (!list) return;
    list.innerHTML = '';
    var pages = ui.stageEl.querySelectorAll('.a4.content');
    pages.forEach(function (pageEl, idx) {
      var num = idx + 1;
      var titleEl = pageEl.querySelector('h1,h2,.page-title,.pt');
      var titleTxt = titleEl ? titleEl.textContent.trim().slice(0, 30) : ('Pagina ' + num);
      var card = $('div', { class: 'mb-page-card', 'data-page': String(num), title: 'Ga naar pagina ' + num });
      var numEl = $('div', { class: 'mb-page-card-num', text: String(num) });
      var lbl = $('div', { class: 'mb-page-card-label', text: titleTxt });
      card.appendChild(numEl);
      card.appendChild(lbl);
      card.addEventListener('click', function () {
        pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        markActivePage(num);
      });
      list.appendChild(card);
    });
  }

  function markActivePage(num) {
    var list = document.getElementById('mbPageNavList');
    if (!list) return;
    Array.prototype.forEach.call(list.children, function (card) {
      card.classList.toggle('mb-page-card-active', card.getAttribute('data-page') === String(num));
    });
  }

  // --------------------------------------------------------------------
  // Eigenschappenpaneel (rechts)
  // --------------------------------------------------------------------

  function buildPropertiesPanel() {
    var panel = $('div', { class: 'mb-editor-panel', id: 'mbPropertiesPanel' });
    panel.appendChild($('div', { class: 'mb-panel-empty', id: 'mbPanelEmpty', text: 'Selecteer een element in het rapport om het te bewerken.' }));
    var body = $('div', { class: 'mb-panel-body', id: 'mbPanelBody' });
    body.style.display = 'none';
    panel.appendChild(body);
    document.body.appendChild(panel);
    ui.panelEl = panel;
  }

  /** Bouwt de inhoud van het eigenschappenpaneel voor het gegeven fieldId. */
  function renderPropertiesPanel(fieldId) {
    var MB = core();
    if (!MB) return;
    var empty = document.getElementById('mbPanelEmpty');
    var body = document.getElementById('mbPanelBody');
    if (!empty || !body) return;

    var el = findElementByField(fieldId);
    if (!el) { hidePropertiesPanel(); return; }

    empty.style.display = 'none';
    body.style.display = '';
    body.innerHTML = '';

    var ov = MB.getOverride(fieldId, MB._internal.guessElementType(el), MB._internal.findPageNumber(el));

    var header = $('div', { class: 'mb-panel-header' });
    header.appendChild($('div', { class: 'mb-panel-field-id', text: fieldId }));
    header.appendChild($('div', { class: 'mb-panel-field-type', text: 'type: ' + ov.type }));
    body.appendChild(header);

    if (MB.state.mode === 'content') {
      body.appendChild(buildContentSection(fieldId, el, ov));
    } else {
      body.appendChild(buildDesignSection(fieldId, el, ov));
    }

    body.appendChild(buildActionsSection(fieldId, el, ov));
  }

  function buildContentSection(fieldId, el, ov) {
    var MB = core();
    var wrap = $('div', { class: 'mb-panel-section' });
    wrap.appendChild($('div', { class: 'mb-panel-section-title', text: 'Inhoud' }));

    if (ov.type === 'text' || ov.type === 'amount' || ov.type === 'block') {
      var textarea = $('textarea', { class: 'mb-input mb-textarea', rows: '4' });
      textarea.value = ov.content.override != null ? ov.content.override : (ov.__baseline ? ov.__baseline.text : el.textContent.trim());
      textarea.addEventListener('change', function () {
        ov.content.override = textarea.value;
        MB.applyOverridesToDom();
        MB.pushHistory();
        scheduleAutosave();
      });
      wrap.appendChild(textarea);
    } else {
      wrap.appendChild($('div', { class: 'mb-panel-hint', text: 'Dit elementtype ondersteunt geen directe tekstbewerking hier. Gebruik dubbelklikken op het element in het rapport.' }));
    }

    // kleur
    var colorRow = $('div', { class: 'mb-panel-row' });
    colorRow.appendChild($('label', { text: 'Tekstkleur' }));
    var colorInput = $('input', { type: 'color', class: 'mb-input-color' });
    colorInput.value = toHexColor(ov.style.color) || '#1a1a1a';
    colorInput.addEventListener('change', function () {
      ov.style.color = colorInput.value;
      MB.applyOverridesToDom();
      MB.pushHistory();
      scheduleAutosave();
    });
    colorRow.appendChild(colorInput);
    wrap.appendChild(colorRow);

    // uitlijning
    var alignRow = $('div', { class: 'mb-panel-row' });
    alignRow.appendChild($('label', { text: 'Uitlijning' }));
    var alignSel = $('select', { class: 'mb-input' });
    ['left', 'center', 'right', 'justify'].forEach(function (opt) {
      var o = $('option', { value: opt, text: opt });
      alignSel.appendChild(o);
    });
    alignSel.value = ov.style.textAlign || 'left';
    alignSel.addEventListener('change', function () {
      ov.style.textAlign = alignSel.value;
      MB.applyOverridesToDom();
      MB.pushHistory();
      scheduleAutosave();
    });
    alignRow.appendChild(alignSel);
    wrap.appendChild(alignRow);

    return wrap;
  }

  function buildDesignSection(fieldId, el, ov) {
    var MB = core();
    var wrap = $('div', { class: 'mb-panel-section' });
    wrap.appendChild($('div', { class: 'mb-panel-section-title', text: 'Vormgeving' }));

    var isDetached = (ov.style.x != null || ov.style.y != null);

    if (!isDetached) {
      var freeBtn = $('button', { class: 'mb-btn mb-btn-block', type: 'button', text: 'Los positioneren' });
      freeBtn.title = 'Maak dit element los van de normale rapportopmaak zodat het vrij versleept kan worden';
      freeBtn.addEventListener('click', function () {
        detachElementForFreePositioning(fieldId, el, ov);
        renderPropertiesPanel(fieldId);
      });
      wrap.appendChild(freeBtn);
    } else {
      // positie/afmeting-velden (alleen relevant als losgemaakt)
      wrap.appendChild(buildNumberRow('X (mm)', ov.style.x, function (v) {
        ov.style.x = clamp(v, 0, PAGE_W_MM); applyAndSave(fieldId, ov);
      }));
      wrap.appendChild(buildNumberRow('Y (mm)', ov.style.y, function (v) {
        ov.style.y = clamp(v, 0, PAGE_H_MM); applyAndSave(fieldId, ov);
      }));
      wrap.appendChild(buildNumberRow('Breedte (mm)', ov.style.w, function (v) {
        ov.style.w = clamp(v, 1, PAGE_W_MM); applyAndSave(fieldId, ov);
      }));
      wrap.appendChild(buildNumberRow('Hoogte (mm)', ov.style.h, function (v) {
        ov.style.h = clamp(v, 1, PAGE_H_MM); applyAndSave(fieldId, ov);
      }));
    }

    wrap.appendChild(buildColorRow('Achtergrondkleur', ov.style.bg, function (v) {
      ov.style.bg = v; applyAndSave(fieldId, ov);
    }));
    wrap.appendChild(buildColorRow('Tekstkleur', ov.style.color, function (v) {
      ov.style.color = v; applyAndSave(fieldId, ov);
    }));
    wrap.appendChild(buildNumberRow('Lettergrootte (px)', parsePx(ov.style.fontSize), function (v) {
      ov.style.fontSize = v + 'px'; applyAndSave(fieldId, ov);
    }));
    wrap.appendChild(buildNumberRow('Randdikte (px)', parsePx(ov.style.border), function (v) {
      ov.style.border = v + 'px solid #999999'; applyAndSave(fieldId, ov);
    }));
    wrap.appendChild(buildNumberRow('Hoekafronding (px)', parsePx(ov.style.borderRadius), function (v) {
      ov.style.borderRadius = v + 'px'; applyAndSave(fieldId, ov);
    }));

    var shadowRow = $('div', { class: 'mb-panel-row' });
    shadowRow.appendChild($('label', { text: 'Schaduw' }));
    var shadowCheck = $('input', { type: 'checkbox' });
    shadowCheck.checked = !!ov.style.boxShadow;
    shadowCheck.addEventListener('change', function () {
      ov.style.boxShadow = shadowCheck.checked ? '0 2px 8px rgba(0,0,0,0.18)' : null;
      applyAndSave(fieldId, ov);
    });
    shadowRow.appendChild(shadowCheck);
    wrap.appendChild(shadowRow);

    var opacityRow = $('div', { class: 'mb-panel-row' });
    opacityRow.appendChild($('label', { text: 'Transparantie' }));
    var opacityRange = $('input', { type: 'range', min: '0', max: '100', step: '5' });
    opacityRange.value = String(ov.style.opacity != null ? Math.round(ov.style.opacity * 100) : 100);
    opacityRange.addEventListener('input', function () {
      ov.style.opacity = (parseFloat(opacityRange.value) / 100).toFixed(2);
      applyAndSave(fieldId, ov);
    });
    opacityRow.appendChild(opacityRange);
    wrap.appendChild(opacityRow);

    wrap.appendChild(buildNumberRow('Interne padding (px)', parsePx(ov.style.padding), function (v) {
      ov.style.padding = v + 'px'; applyAndSave(fieldId, ov);
    }));
    wrap.appendChild(buildNumberRow('Externe marge (px)', parsePx(ov.style.margin), function (v) {
      ov.style.margin = v + 'px'; applyAndSave(fieldId, ov);
    }));

    var lockRow = $('div', { class: 'mb-panel-row' });
    lockRow.appendChild($('label', { text: 'Element vergrendelen' }));
    var lockCheck = $('input', { type: 'checkbox' });
    lockCheck.checked = !!ov.locked;
    lockCheck.addEventListener('change', function () {
      ov.locked = lockCheck.checked;
      MB.pushHistory();
      scheduleAutosave();
    });
    lockRow.appendChild(lockCheck);
    wrap.appendChild(lockRow);

    return wrap;
  }

  function applyAndSave(fieldId, ov) {
    var MB = core();
    if (!MB) return;
    MB.applyOverridesToDom();
    MB.pushHistory();
    scheduleAutosave();
    // eventuele waarschuwingsrand direct bijwerken
    var el = findElementByField(fieldId);
    if (el) updateOutOfBoundsWarning(el, ov);
  }

  function buildNumberRow(labelTxt, value, onChange) {
    var row = $('div', { class: 'mb-panel-row' });
    row.appendChild($('label', { text: labelTxt }));
    var input = $('input', { type: 'number', class: 'mb-input', step: '0.5' });
    input.value = (value != null) ? value : '';
    input.addEventListener('change', function () {
      var v = parseFloat(input.value);
      if (!isNaN(v)) onChange(v);
    });
    row.appendChild(input);
    return row;
  }

  function buildColorRow(labelTxt, value, onChange) {
    var row = $('div', { class: 'mb-panel-row' });
    row.appendChild($('label', { text: labelTxt }));
    var input = $('input', { type: 'color', class: 'mb-input-color' });
    input.value = toHexColor(value) || '#ffffff';
    input.addEventListener('change', function () { onChange(input.value); });
    row.appendChild(input);
    return row;
  }

  function parsePx(val) {
    if (val == null) return null;
    var n = parseFloat(val);
    return isNaN(n) ? null : n;
  }

  function toHexColor(val) {
    if (!val) return null;
    if (/^#/.test(val)) return val;
    // rgb(...) -> hex, best effort
    var m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(val);
    if (!m) return null;
    function h(n) { return ('0' + parseInt(n, 10).toString(16)).slice(-2); }
    return '#' + h(m[1]) + h(m[2]) + h(m[3]);
  }

  function buildActionsSection(fieldId, el, ov) {
    var wrap = $('div', { class: 'mb-panel-section' });
    wrap.appendChild($('div', { class: 'mb-panel-section-title', text: 'Acties' }));
    var grid = $('div', { class: 'mb-panel-actions-grid' });

    grid.appendChild(actionBtn('Dupliceren', function () { duplicateElement(fieldId); }));
    grid.appendChild(actionBtn('Verwijderen', function () { deleteElement(fieldId, true); }));
    grid.appendChild(actionBtn('Verbergen', function () { toggleVisibility(fieldId); }));
    grid.appendChild(actionBtn('Naar voren', function () { changeZOrder(fieldId, 1); }));
    grid.appendChild(actionBtn('Naar achteren', function () { changeZOrder(fieldId, -1); }));
    grid.appendChild(actionBtn('Positie herstellen', function () { resetPosition(fieldId); }));
    grid.appendChild(actionBtn('Standaardstijl herstellen', function () { resetStyle(fieldId); }));

    wrap.appendChild(grid);
    return wrap;
  }

  function actionBtn(label, handler) {
    var b = $('button', { class: 'mb-btn mb-btn-small', type: 'button', text: label });
    b.addEventListener('click', handler);
    return b;
  }

  function hidePropertiesPanel() {
    var empty = document.getElementById('mbPanelEmpty');
    var body = document.getElementById('mbPanelBody');
    if (empty) empty.style.display = '';
    if (body) { body.style.display = 'none'; body.innerHTML = ''; }
  }

  // --------------------------------------------------------------------
  // Selectie & hover (event delegation op #rptStage)
  // --------------------------------------------------------------------

  function bindStageEvents() {
    var stage = ui.stageEl;
    if (!stage) return;

    stage.addEventListener('mouseover', function (e) {
      var MB = core();
      if (!MB || !MB.state.active) return;
      var target = e.target.closest('[data-field]');
      if (!target || !stage.contains(target)) return;
      target.classList.add('mb-hover');
    });

    stage.addEventListener('mouseout', function (e) {
      var target = e.target.closest && e.target.closest('[data-field]');
      if (!target) return;
      target.classList.remove('mb-hover');
    });

    stage.addEventListener('click', function (e) {
      var MB = core();
      if (!MB || !MB.state.active) return;
      var target = e.target.closest('[data-field]');
      if (!target || !stage.contains(target)) return;
      // klikken binnen een actief contentEditable-element mag niet de selectie resetten
      if (target.isContentEditable) return;

      e.preventDefault();
      var fieldId = target.getAttribute('data-field');
      selectElement(fieldId, target, e.shiftKey);
    });

    stage.addEventListener('dblclick', function (e) {
      var MB = core();
      if (!MB || !MB.state.active || MB.state.mode !== 'content') return;
      var target = e.target.closest('[data-field]');
      if (!target) return;
      var ov = MB.getOverride(target.getAttribute('data-field'), MB._internal.guessElementType(target), MB._internal.findPageNumber(target));
      if (ov.type !== 'text' && ov.type !== 'amount' && ov.type !== 'block') return; // alleen tekstachtige elementen
      startTextEdit(target, target.getAttribute('data-field'));
    });
  }

  function selectElement(fieldId, el, additive) {
    var MB = core();
    if (!MB) return;

    if (!additive) {
      clearSelection();
      MB.state.selection = [fieldId];
    } else {
      if (MB.state.selection.indexOf(fieldId) === -1) {
        MB.state.selection.push(fieldId);
      }
    }
    el.classList.add('mb-selected');
    MB.captureBaseline(fieldId, el);

    if (MB.state.selection.length === 1) {
      renderPropertiesPanel(fieldId);
      // toon drag-handle in vormgeving-modus
      if (MB.state.mode === 'design') attachDragHandle(el, fieldId);
    } else {
      hidePropertiesPanel();
    }
    markActivePage(MB._internal.findPageNumber(el));
  }

  function clearSelection() {
    var MB = core();
    if (!MB) return;
    if (ui.stageEl) {
      ui.stageEl.querySelectorAll('.mb-selected').forEach(function (el) {
        el.classList.remove('mb-selected');
        removeDragHandle(el);
      });
    }
    MB.state.selection = [];
    hidePropertiesPanel();
  }

  function findElementByField(fieldId) {
    if (!ui.stageEl) return null;
    try {
      return ui.stageEl.querySelector('[data-field="' + fieldId.replace(/(["\\])/g, '\\$1') + '"]');
    } catch (e) {
      return null;
    }
  }

  // --------------------------------------------------------------------
  // Tekstbewerking (dubbelklik -> contentEditable + mini-toolbar)
  // --------------------------------------------------------------------

  function startTextEdit(el, fieldId) {
    // Legt de tekst vóór bewerking vast — nodig voor (a) de vergelijking of
    // er daadwerkelijk iets gewijzigd is, en (b) om bij "Annuleren"/
    // "Onderliggende invoer aanpassen" de contentEditable-tekst exact terug
    // te kunnen rollen (zie handleComputedFieldLinkWarning hieronder).
    var originalText = el.innerText != null ? el.innerText : el.textContent;

    el.setAttribute('contenteditable', 'true');
    el.classList.add('mb-editing');
    el.focus();
    showMiniToolbar(el);

    function onBlur() {
      stopTextEdit(el, fieldId, originalText);
    }
    function onKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        stopTextEdit(el, fieldId, originalText);
      }
    }
    el.__mbBlurHandler = onBlur;
    el.__mbKeydownHandler = onKeydown;
    el.addEventListener('blur', onBlur);
    el.addEventListener('keydown', onKeydown);
  }

  /**
   * Bepaalt of een fieldId een direct datapad is (bijv. "capex_totaal",
   * "maatregelen[2].capex") i.p.v. een decoratief blok ("block:...") of een
   * vrij tekstveld ("content:..."). Directe datapaden komen uit een
   * berekening in de rapportdata (d) en worden bij elke render opnieuw
   * bepaald — vandaar de koppelingswaarschuwing bij handmatige bewerking.
   */
  function isComputedDataField(fieldId) {
    var id = String(fieldId || '');
    return id.indexOf('block:') !== 0 && id.indexOf('content:') !== 0;
  }

  function stopTextEdit(el, fieldId, originalText) {
    var MB = core();
    if (!MB) return;
    var newText = el.innerText != null ? el.innerText : el.textContent;

    // ── Verplichte waarschuwing: koppeling met berekeningen (spec §9) ──
    // Als het bewerkte veld een berekend/uit-data-komend veld is (geen
    // "block:"/"content:"-veld) én de tekst daadwerkelijk is gewijzigd,
    // moet de gebruiker eerst expliciet kiezen hoe hiermee om te gaan
    // vóórdat de wijziging wordt gecommit. Dit voorkomt dat iemand
    // onbewust een berekend cijfer "vastzet" op een handmatige waarde.
    if (isComputedDataField(fieldId) && newText !== originalText) {
      handleComputedFieldLinkWarning(el, fieldId, originalText, newText, function (action, finalText, linkBroken) {
        finishTextEdit(el, fieldId, action, finalText, linkBroken);
      });
      return; // opruiming (contentEditable afzetten etc.) gebeurt in finishTextEdit, ná de keuze
    }

    finishTextEdit(el, fieldId, 'commit', newText, false);
  }

  /**
   * Toont een bevestigingsdialoog wanneer een berekend/data-gekoppeld veld
   * handmatig wordt aangepast. Roept callback(action, finalText, linkBroken)
   * aan met:
   *   action: 'commit' | 'cancel'
   *   finalText: de tekst die uiteindelijk in het element/de override komt
   *   linkBroken: of de koppeling met de berekening expliciet is verbroken
   */
  function handleComputedFieldLinkWarning(el, fieldId, originalText, newText, callback) {
    var overlay = $('div', { class: 'mb-linkwarning-overlay' });
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:100000;display:flex;align-items:center;justify-content:center;';

    var modal = $('div', { class: 'mb-linkwarning-modal' });
    modal.style.cssText = 'background:#fff;border-radius:10px;max-width:420px;width:90%;padding:20px 22px;box-shadow:0 20px 60px rgba(0,0,0,.35);font-family:inherit;';

    var title = $('div', { text: 'Let op: gekoppelde waarde' });
    title.style.cssText = 'font-weight:800;font-size:14px;color:#0d3348;margin-bottom:8px;';
    modal.appendChild(title);

    // Exacte, verplichte waarschuwingstekst (spec §9) — niet parafraseren.
    var msg = $('div', { text: 'Deze waarde is gekoppeld aan een berekening. Handmatig aanpassen verbreekt de automatische koppeling.' });
    msg.style.cssText = 'font-size:12.5px;color:#333;line-height:1.5;margin-bottom:16px;';
    modal.appendChild(msg);

    var btnRow = $('div', { class: 'mb-linkwarning-actions' });
    btnRow.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

    function makeChoiceBtn(label) {
      var b = $('button', { type: 'button', text: label });
      b.style.cssText = 'width:100%;text-align:left;padding:9px 12px;border-radius:7px;border:1px solid #d7dee6;background:#f7f8fa;cursor:pointer;font-size:12.5px;color:#0d3348;';
      b.addEventListener('mouseenter', function () { b.style.background = '#eef2f6'; });
      b.addEventListener('mouseleave', function () { b.style.background = '#f7f8fa'; });
      return b;
    }

    function close(fn) {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      fn();
    }

    // (1) Alleen weergavetekst aanpassen -> content.override, linkBroken:false
    var b1 = makeChoiceBtn('Alleen weergavetekst aanpassen');
    b1.addEventListener('click', function () {
      close(function () { callback('commit', newText, false); });
    });

    // (2) Onderliggende invoer aanpassen -> annuleren + doorverwijzen naar bronformulier
    var b2 = makeChoiceBtn('Onderliggende invoer aanpassen');
    b2.addEventListener('click', function () {
      close(function () {
        toast('Pas dit aan vóór het genereren van het rapport, in het bronformulier.', 'info');
        callback('cancel', originalText, false);
      });
    });

    // (3) Koppeling verbreken -> content.override, linkBroken:true
    var b3 = makeChoiceBtn('Koppeling verbreken');
    b3.addEventListener('click', function () {
      close(function () { callback('commit', newText, true); });
    });

    // (4) Annuleren -> geen commit, tekst terugrollen
    var b4 = makeChoiceBtn('Annuleren');
    b4.addEventListener('click', function () {
      close(function () { callback('cancel', originalText, false); });
    });

    [b1, b2, b3, b4].forEach(function (b) { btnRow.appendChild(b); });
    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  /** Rondt tekstbewerking af: zet contentEditable uit en committeert (of annuleert) de wijziging. */
  function finishTextEdit(el, fieldId, action, finalText, linkBroken) {
    var MB = core();
    if (!MB) return;

    el.removeAttribute('contenteditable');
    el.classList.remove('mb-editing');
    if (el.__mbBlurHandler) el.removeEventListener('blur', el.__mbBlurHandler);
    if (el.__mbKeydownHandler) el.removeEventListener('keydown', el.__mbKeydownHandler);
    hideMiniToolbar();

    if (action === 'cancel') {
      // Tekst terugrollen naar de oorspronkelijke waarde; geen commit.
      if (finalText != null) el.innerText = finalText;
      return;
    }

    if (finalText != null && el.innerText !== finalText) {
      el.innerText = finalText;
    }

    var ov = MB.getOverride(fieldId, MB._internal.guessElementType(el), MB._internal.findPageNumber(el));
    ov.content.override = finalText;
    if (typeof linkBroken === 'boolean') ov.content.linkBroken = linkBroken;
    MB.pushHistory();
    scheduleAutosave();

    updateOverflowWarning(el);
  }

  /** Toont/verbergt een rode waarschuwing als tekst niet meer past (scrollHeight > clientHeight). */
  function updateOverflowWarning(el) {
    var existing = el.parentElement ? el.parentElement.querySelector(':scope > .mb-overflow-warning[data-for="' + (el.getAttribute('data-field') || '') + '"]') : null;
    var overflows = el.scrollHeight > el.clientHeight + 1;
    if (overflows) {
      if (!existing && el.parentElement) {
        var warn = $('div', { class: 'mb-overflow-warning', text: 'Tekst past niet meer binnen dit vak.' });
        warn.setAttribute('data-for', el.getAttribute('data-field') || '');
        el.parentElement.insertBefore(warn, el.nextSibling);
      }
    } else if (existing) {
      existing.remove();
    }
  }

  function updateOutOfBoundsWarning(el, ov) {
    var s = ov.style;
    if (s.x == null && s.y == null && s.w == null && s.h == null) {
      el.classList.remove('mb-out-of-bounds');
      return;
    }
    var x = s.x || 0, y = s.y || 0, w = s.w || 0, h = s.h || 0;
    var bad = (x < MARGIN_MM || y < MARGIN_MM || (x + w) > (PAGE_W_MM - MARGIN_MM) || (y + h) > (PAGE_H_MM - MARGIN_MM));
    el.classList.toggle('mb-out-of-bounds', bad);
  }

  function showMiniToolbar(el) {
    hideMiniToolbar();
    var tb = $('div', { class: 'mb-mini-toolbar' });

    function cmdBtn(label, title, exec) {
      var b = $('button', { type: 'button', text: label, title: title });
      // voorkom focus-verlies (en dus voortijdig sluiten) bij het klikken op de mini-toolbar
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });
      b.addEventListener('click', exec);
      return b;
    }

    tb.appendChild(cmdBtn('B', 'Vet', function () { document.execCommand('bold'); }));
    tb.appendChild(cmdBtn('I', 'Cursief', function () { document.execCommand('italic'); }));
    tb.appendChild(cmdBtn('U', 'Onderstreept', function () { document.execCommand('underline'); }));
    tb.appendChild(cmdBtn('⟵', 'Links uitlijnen', function () { document.execCommand('justifyLeft'); }));
    tb.appendChild(cmdBtn('⟷', 'Centreren', function () { document.execCommand('justifyCenter'); }));
    tb.appendChild(cmdBtn('⟶', 'Rechts uitlijnen', function () { document.execCommand('justifyRight'); }));
    var colorInput = $('input', { type: 'color', title: 'Tekstkleur' });
    colorInput.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    colorInput.addEventListener('change', function () {
      document.execCommand('foreColor', false, colorInput.value);
    });
    tb.appendChild(colorInput);

    document.body.appendChild(tb);
    positionMiniToolbar(tb, el);
    ui.activeMiniToolbarEl = tb;
  }

  function positionMiniToolbar(tb, el) {
    var rect = el.getBoundingClientRect();
    tb.style.position = 'fixed';
    tb.style.left = Math.max(4, rect.left) + 'px';
    tb.style.top = Math.max(4, rect.top - 40) + 'px';
  }

  function hideMiniToolbar() {
    if (ui.activeMiniToolbarEl) {
      ui.activeMiniToolbarEl.remove();
      ui.activeMiniToolbarEl = null;
    }
  }

  // --------------------------------------------------------------------
  // Hybride positionering: drag-handle, loskoppelen en resize-handles
  // --------------------------------------------------------------------

  /** Voegt een zichtbare drag-handle toe aan het geselecteerde element (alleen in vormgeving-modus). */
  function attachDragHandle(el, fieldId) {
    removeAllDragHandles();
    var MB = core();
    if (!MB || MB.state.mode !== 'design') return;

    var handle = $('div', { class: 'mb-drag-handle', title: 'Sleep om te verplaatsen' });
    handle.textContent = '✥';
    // handle wordt relatief aan het element gepositioneerd via CSS (position:absolute in .mb-editor.css)
    if (getComputedStyle(el).position === 'static') {
      // nog niet losgemaakt: eerste sleepbeweging maakt 'm los (zie onDragHandleMouseDown)
    }
    el.style.position = el.style.position || undefined;
    (el.offsetParent ? el : el).appendChild ? null : null;
    // plaats de handle als sibling zodat 'm positioneren via CSS simpel blijft
    var container = el.parentElement || el;
    handle.__mbTargetField = fieldId;
    el.appendChild(handle);

    handle.addEventListener('mousedown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      startDrag(el, fieldId, e);
    });

    // resize-handles alleen tonen als het element al losgemaakt is
    var ov = MB.getOverride(fieldId, MB._internal.guessElementType(el), MB._internal.findPageNumber(el));
    if (ov.style.x != null || ov.style.y != null) {
      attachResizeHandles(el, fieldId);
    }
  }

  function removeDragHandle(el) {
    var h = el.querySelector ? el.querySelector(':scope > .mb-drag-handle') : null;
    if (h) h.remove();
    var handles = el.querySelectorAll ? el.querySelectorAll(':scope > .mb-handle') : [];
    handles.forEach(function (x) { x.remove(); });
  }

  function removeAllDragHandles() {
    if (!ui.stageEl) return;
    ui.stageEl.querySelectorAll('.mb-drag-handle, .mb-handle').forEach(function (x) { x.remove(); });
  }

  var RESIZE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  function attachResizeHandles(el, fieldId) {
    RESIZE_DIRS.forEach(function (dir) {
      var h = $('div', { class: 'mb-handle mb-handle-' + dir, 'data-dir': dir });
      h.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();
        startResize(el, fieldId, dir, e);
      });
      el.appendChild(h);
    });
  }

  /**
   * Maakt een element los van de normale flow: zet position:absolute met de
   * huidige (gemeten) positie in mm t.o.v. de paginarand als startwaarde.
   */
  function detachElementForFreePositioning(fieldId, el, ov) {
    var MB = core();
    var pageEl = el.closest('.a4.content');
    if (!pageEl) { toast('Kan pagina niet bepalen voor dit element.', 'error'); return; }
    var scale = getPageScale(pageEl);
    var elRect = el.getBoundingClientRect();

    var xMm = (elRect.left - scale.rect.left) / scale.pxPerMmX;
    var yMm = (elRect.top - scale.rect.top) / scale.pxPerMmY;
    var wMm = elRect.width / scale.pxPerMmX;
    var hMm = elRect.height / scale.pxPerMmY;

    ov.style.x = round1(clamp(xMm, 0, PAGE_W_MM));
    ov.style.y = round1(clamp(yMm, 0, PAGE_H_MM));
    ov.style.w = round1(clamp(wMm, 1, PAGE_W_MM));
    ov.style.h = round1(clamp(hMm, 1, PAGE_H_MM));

    pageEl.classList.add('mb-positioning-context');
    MB.applyOverridesToDom();
    MB.pushHistory();
    scheduleAutosave();
    attachDragHandle(el, fieldId); // handles vernieuwen zodat resize-handles nu ook verschijnen
  }

  // --- Slepen ---

  function startDrag(el, fieldId, startEvent) {
    var MB = core();
    if (!MB) return;
    var ov = MB.getOverride(fieldId, MB._internal.guessElementType(el), MB._internal.findPageNumber(el));
    if (ov.locked) { toast('Dit element is vergrendeld.', 'warning'); return; }

    var pageEl = el.closest('.a4.content');
    if (!pageEl) return;

    // als nog niet losgemaakt: eerst loskoppelen met huidige positie als start
    if (ov.style.x == null || ov.style.y == null) {
      detachElementForFreePositioning(fieldId, el, ov);
    }

    var scale = getPageScale(pageEl);
    ui.dragState = {
      type: 'move',
      el: el, fieldId: fieldId, ov: ov, pageEl: pageEl, scale: scale,
      startMouseX: startEvent.clientX, startMouseY: startEvent.clientY,
      startX: ov.style.x, startY: ov.style.y
    };

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e) {
    var ds = ui.dragState;
    if (!ds || ds.type !== 'move') return;
    var dxMm = (e.clientX - ds.startMouseX) / ds.scale.pxPerMmX;
    var dyMm = (e.clientY - ds.startMouseY) / ds.scale.pxPerMmY;

    var newX = ds.startX + dxMm;
    var newY = ds.startY + dyMm;

    var w = ds.ov.style.w || 0;
    var h = ds.ov.style.h || 0;

    var snapped = applySnapping(newX, newY, w, h, ds.fieldId);
    newX = snapped.x; newY = snapped.y;

    newX = clamp(newX, 0, PAGE_W_MM - w);
    newY = clamp(newY, 0, PAGE_H_MM - h);

    ds.ov.style.x = round1(newX);
    ds.ov.style.y = round1(newY);

    // direct visuele feedback (zonder volledige applyOverridesToDom, voor performance)
    ds.el.style.position = 'absolute';
    ds.el.style.left = ds.ov.style.x + 'mm';
    ds.el.style.top = ds.ov.style.y + 'mm';
    updateOutOfBoundsWarning(ds.el, ds.ov);
    drawGuides(snapped.guideLines || []);
  }

  function onDragEnd() {
    var MB = core();
    var ds = ui.dragState;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    clearGuides();
    if (!ds || !MB) { ui.dragState = null; return; }
    MB.applyOverridesToDom();
    MB.pushHistory();
    scheduleAutosave();
    ui.dragState = null;
  }

  // --- Resizen ---

  function startResize(el, fieldId, dir, startEvent) {
    var MB = core();
    if (!MB) return;
    var ov = MB.getOverride(fieldId, MB._internal.guessElementType(el), MB._internal.findPageNumber(el));
    if (ov.locked) { toast('Dit element is vergrendeld.', 'warning'); return; }
    var pageEl = el.closest('.a4.content');
    if (!pageEl) return;
    var scale = getPageScale(pageEl);

    ui.dragState = {
      type: 'resize', dir: dir,
      el: el, fieldId: fieldId, ov: ov, pageEl: pageEl, scale: scale,
      startMouseX: startEvent.clientX, startMouseY: startEvent.clientY,
      startX: ov.style.x || 0, startY: ov.style.y || 0,
      startW: ov.style.w || 20, startH: ov.style.h || 10
    };
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
  }

  function onResizeMove(e) {
    var ds = ui.dragState;
    if (!ds || ds.type !== 'resize') return;
    var dxMm = (e.clientX - ds.startMouseX) / ds.scale.pxPerMmX;
    var dyMm = (e.clientY - ds.startMouseY) / ds.scale.pxPerMmY;

    var x = ds.startX, y = ds.startY, w = ds.startW, h = ds.startH;
    var dir = ds.dir;

    if (dir.indexOf('e') !== -1) w = ds.startW + dxMm;
    if (dir.indexOf('s') !== -1) h = ds.startH + dyMm;
    if (dir.indexOf('w') !== -1) { w = ds.startW - dxMm; x = ds.startX + dxMm; }
    if (dir.indexOf('n') !== -1) { h = ds.startH - dyMm; y = ds.startY + dyMm; }

    w = clamp(w, 5, PAGE_W_MM);
    h = clamp(h, 5, PAGE_H_MM);
    x = clamp(x, 0, PAGE_W_MM - w);
    y = clamp(y, 0, PAGE_H_MM - h);

    if (ui.snapEnabled) {
      w = snapToGrid(w);
      h = snapToGrid(h);
    }

    ds.ov.style.x = round1(x);
    ds.ov.style.y = round1(y);
    ds.ov.style.w = round1(w);
    ds.ov.style.h = round1(h);

    ds.el.style.position = 'absolute';
    ds.el.style.left = ds.ov.style.x + 'mm';
    ds.el.style.top = ds.ov.style.y + 'mm';
    ds.el.style.width = ds.ov.style.w + 'mm';
    ds.el.style.height = ds.ov.style.h + 'mm';
    updateOutOfBoundsWarning(ds.el, ds.ov);
  }

  function onResizeEnd() {
    var MB = core();
    var ds = ui.dragState;
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
    clearGuides();
    if (!ds || !MB) { ui.dragState = null; return; }
    MB.applyOverridesToDom();
    MB.pushHistory();
    scheduleAutosave();
    ui.dragState = null;
  }

  // --- Snapping (raster, marges, andere losgemaakte elementen) ---

  function snapToGrid(val) {
    var g = ui.gridSize || DEFAULT_GRID_MM;
    return Math.round(val / g) * g;
  }

  /**
   * Past raster-, marge- en element-snapping toe op een voorgestelde x/y.
   * Retourneert {x, y, guideLines} waarbij guideLines een lijst is van
   * {orientation:'v'|'h', posMm} voor het tekenen van hulplijnen.
   */
  function applySnapping(x, y, w, h, movingFieldId) {
    if (!ui.snapEnabled) return { x: x, y: y, guideLines: [] };

    var guideLines = [];
    var snappedX = snapToGrid(x);
    var snappedY = snapToGrid(y);

    // marge-snapping (10mm rand)
    var candidatesX = [MARGIN_MM, PAGE_W_MM - MARGIN_MM - w];
    var candidatesY = [MARGIN_MM, PAGE_H_MM - MARGIN_MM - h];

    // andere losgemaakte elementen als snap-doelen
    var MB = core();
    if (MB) {
      Object.keys(MB.state.overrides).forEach(function (fid) {
        if (fid === movingFieldId) return;
        var ov = MB.state.overrides[fid];
        if (!ov || ov.style.x == null) return;
        candidatesX.push(ov.style.x);
        if (ov.style.w != null) candidatesX.push(ov.style.x + ov.style.w - w);
        candidatesY.push(ov.style.y);
        if (ov.style.h != null) candidatesY.push(ov.style.y + ov.style.h - h);
      });
    }

    var bestX = null, bestXDist = SNAP_THRESHOLD_MM;
    candidatesX.forEach(function (cx) {
      var dist = Math.abs(cx - x);
      if (dist < bestXDist) { bestXDist = dist; bestX = cx; }
    });
    if (bestX != null) {
      snappedX = bestX;
      guideLines.push({ orientation: 'v', posMm: bestX });
    }

    var bestY = null, bestYDist = SNAP_THRESHOLD_MM;
    candidatesY.forEach(function (cy) {
      var dist = Math.abs(cy - y);
      if (dist < bestYDist) { bestYDist = dist; bestY = cy; }
    });
    if (bestY != null) {
      snappedY = bestY;
      guideLines.push({ orientation: 'h', posMm: bestY });
    }

    return { x: snappedX, y: snappedY, guideLines: guideLines };
  }

  function drawGuides(lines) {
    clearGuides();
    var ds = ui.dragState;
    if (!ds) return;
    var pageRect = ds.pageEl.getBoundingClientRect();
    lines.forEach(function (line) {
      var div = document.createElement('div');
      div.className = 'mb-guide mb-guide-' + line.orientation;
      if (line.orientation === 'v') {
        div.style.left = (pageRect.left + line.posMm * ds.scale.pxPerMmX) + 'px';
        div.style.top = pageRect.top + 'px';
        div.style.height = pageRect.height + 'px';
      } else {
        div.style.top = (pageRect.top + line.posMm * ds.scale.pxPerMmY) + 'px';
        div.style.left = pageRect.left + 'px';
        div.style.width = pageRect.width + 'px';
      }
      document.body.appendChild(div);
      ui.guideEls.push(div);
    });
  }

  function clearGuides() {
    ui.guideEls.forEach(function (g) { g.remove(); });
    ui.guideEls = [];
  }

  // --------------------------------------------------------------------
  // Overige blok-acties
  // --------------------------------------------------------------------

  function duplicateElement(fieldId) {
    var MB = core();
    if (!MB) return;
    var el = findElementByField(fieldId);
    if (!el) { toast('Element niet gevonden.', 'error'); return; }

    // genereer een unieke __copyN-suffix
    var base = fieldId.replace(/__copy\d+$/, '');
    var n = 1;
    var newFieldId = base + '__copy' + n;
    while (MB.state.overrides[newFieldId] || findElementByField(newFieldId)) {
      n++; newFieldId = base + '__copy' + n;
    }

    var clone = el.cloneNode(true);
    clone.setAttribute('data-field', newFieldId);
    clone.classList.remove('mb-selected', 'mb-hover');
    // eventuele oude drag/resize-handles uit de kloon verwijderen
    clone.querySelectorAll('.mb-drag-handle, .mb-handle').forEach(function (h) { h.remove(); });
    el.parentNode.insertBefore(clone, el.nextSibling);

    var srcOv = MB.state.overrides[fieldId] || MB.createDefaultOverride(MB._internal.guessElementType(el), MB._internal.findPageNumber(el));
    var newOv = MB._internal.deepClone(srcOv);
    // dupliceer iets verschoven zodat het niet exact overlapt
    if (newOv.style.x != null) newOv.style.x = clamp((newOv.style.x || 0) + 5, 0, PAGE_W_MM);
    if (newOv.style.y != null) newOv.style.y = clamp((newOv.style.y || 0) + 5, 0, PAGE_H_MM);
    MB.state.overrides[newFieldId] = newOv;

    MB.applyOverridesToDom();
    MB.pushHistory();
    scheduleAutosave();
    toast('Element gedupliceerd.', 'success');
  }

  function deleteElement(fieldId, physical) {
    var MB = core();
    if (!MB) return;
    if (physical) {
      var ok = window.confirm('Dit element definitief verwijderen uit het rapport?');
      if (!ok) return;
      var el = findElementByField(fieldId);
      if (el) el.remove();
    }
    var ov = MB.getOverride(fieldId, 'block', 1);
    ov.visible = false;
    MB.applyOverridesToDom();
    MB.pushHistory();
    scheduleAutosave();
    clearSelection();
    toast('Element verwijderd.', 'success');
  }

  function toggleVisibility(fieldId) {
    var MB = core();
    if (!MB) return;
    var el = findElementByField(fieldId);
    if (!el) return;
    var ov = MB.getOverride(fieldId, MB._internal.guessElementType(el), MB._internal.findPageNumber(el));
    ov.visible = !ov.visible;
    MB.applyOverridesToDom();
    MB.pushHistory();
    scheduleAutosave();
  }

  function changeZOrder(fieldId, delta) {
    var MB = core();
    if (!MB) return;
    var el = findElementByField(fieldId);
    if (!el) return;
    var ov = MB.getOverride(fieldId, MB._internal.guessElementType(el), MB._internal.findPageNumber(el));
    var current = parseInt(ov.style.zIndex, 10);
    if (isNaN(current)) current = 1;
    ov.style.zIndex = String(current + delta);
    MB.applyOverridesToDom();
    MB.pushHistory();
    scheduleAutosave();
  }

  function resetPosition(fieldId) {
    var MB = core();
    if (!MB) return;
    var el = findElementByField(fieldId);
    var ov = MB.state.overrides[fieldId];
    if (!ov) return;
    ov.style.x = null; ov.style.y = null; ov.style.w = null; ov.style.h = null;
    if (el) {
      el.style.position = 'static';
      el.style.left = ''; el.style.top = ''; el.style.width = ''; el.style.height = '';
      removeDragHandle(el);
    }
    MB.pushHistory();
    scheduleAutosave();
    if (MB.state.selection.length === 1) renderPropertiesPanel(fieldId);
  }

  function resetStyle(fieldId) {
    var MB = core();
    if (!MB) return;
    var ov = MB.state.overrides[fieldId];
    if (!ov) return;
    var type = ov.type, page = ov.page, content = ov.content;
    var fresh = MB.createDefaultOverride(type, page);
    fresh.content = content; // tekst blijft behouden, alleen stijl reset
    MB.state.overrides[fieldId] = fresh;
    var el = findElementByField(fieldId);
    if (el) {
      el.removeAttribute('style');
      removeDragHandle(el);
    }
    MB.applyOverridesToDom();
    MB.pushHistory();
    scheduleAutosave();
    if (MB.state.selection.length === 1) renderPropertiesPanel(fieldId);
  }

  // --------------------------------------------------------------------
  // Sneltoetsen
  // --------------------------------------------------------------------

  function bindKeyboardShortcuts() {
    document.addEventListener('keydown', function (e) {
      var MB = core();
      if (!MB || !MB.state.active) return;
      var activeEl = document.activeElement;
      if (activeEl && activeEl.isContentEditable) return; // niet storen tijdens tekstinvoer
      var tag = activeEl ? activeEl.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      var ctrlOrCmd = e.ctrlKey || e.metaKey;

      if (ctrlOrCmd && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault(); doUndo(); return;
      }
      if (ctrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault(); doRedo(); return;
      }
      if (ctrlOrCmd && e.key.toLowerCase() === 's') {
        e.preventDefault(); saveReport(true); return;
      }
      if (e.key === 'Escape') {
        e.preventDefault(); clearSelection(); return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (MB.state.selection.length === 1) {
          e.preventDefault();
          deleteElement(MB.state.selection[0], false);
        }
        return;
      }
      if (e.key.indexOf('Arrow') === 0 && MB.state.selection.length === 1) {
        var fieldId = MB.state.selection[0];
        var ov = MB.state.overrides[fieldId];
        if (!ov || ov.style.x == null) return; // alleen losgemaakte elementen kunnen nudgen
        e.preventDefault();
        var step = e.shiftKey ? 5 : 1;
        if (e.key === 'ArrowLeft') ov.style.x = clamp(round1(ov.style.x - step), 0, PAGE_W_MM);
        if (e.key === 'ArrowRight') ov.style.x = clamp(round1(ov.style.x + step), 0, PAGE_W_MM);
        if (e.key === 'ArrowUp') ov.style.y = clamp(round1(ov.style.y - step), 0, PAGE_H_MM);
        if (e.key === 'ArrowDown') ov.style.y = clamp(round1(ov.style.y + step), 0, PAGE_H_MM);
        MB.applyOverridesToDom();
        MB.pushHistory();
        scheduleAutosave();
      }
    });
  }

  function doUndo() {
    var MB = core();
    if (!MB) return;
    if (MB.undo()) {
      clearSelection();
      toast('Ongedaan gemaakt.', 'info');
    } else {
      toast('Niets om ongedaan te maken.', 'info');
    }
  }

  function doRedo() {
    var MB = core();
    if (!MB) return;
    if (MB.redo()) {
      clearSelection();
      toast('Opnieuw uitgevoerd.', 'info');
    } else {
      toast('Niets om opnieuw uit te voeren.', 'info');
    }
  }

  // --------------------------------------------------------------------
  // Validatiepaneel
  // --------------------------------------------------------------------

  function buildValidationPanel() {
    var panel = $('div', { class: 'mb-validation-panel', id: 'mbValidationPanel' });
    panel.style.display = 'none';
    var header = $('div', { class: 'mb-validation-header' });
    header.appendChild($('div', { text: 'Rapportcontrole', class: 'mb-validation-title' }));
    var closeBtn = $('button', { type: 'button', class: 'mb-btn mb-btn-small', text: 'Sluiten' });
    closeBtn.addEventListener('click', closeValidationPanel);
    header.appendChild(closeBtn);
    panel.appendChild(header);
    panel.appendChild($('div', { class: 'mb-validation-list', id: 'mbValidationList' }));
    document.body.appendChild(panel);
    ui.validationEl = panel;
  }

  function runValidationPanel() {
    var MB = core();
    if (!MB) { toast('Editor-core niet geladen.', 'error'); return; }
    var results = [];
    try {
      results = MB.validation.runAll() || [];
    } catch (e) {
      console.warn('[MBEditorUI] validation.runAll() gaf een fout', e);
    }

    var list = document.getElementById('mbValidationList');
    if (!list) return;
    list.innerHTML = '';

    if (results.length === 0) {
      list.appendChild($('div', { class: 'mb-validation-empty', text: 'Geen problemen gevonden.' }));
    } else {
      // groepeer per pagina
      var byPage = {};
      results.forEach(function (r) {
        var p = r.page != null ? r.page : 'Algemeen';
        if (!byPage[p]) byPage[p] = [];
        byPage[p].push(r);
      });
      Object.keys(byPage).sort().forEach(function (p) {
        var group = $('div', { class: 'mb-validation-group' });
        group.appendChild($('div', { class: 'mb-validation-group-title', text: 'Pagina ' + p }));
        byPage[p].forEach(function (r) {
          var item = $('div', { class: 'mb-validation-item mb-severity-' + r.severity });
          item.appendChild($('span', { class: 'mb-validation-code', text: r.code }));
          item.appendChild($('span', { class: 'mb-validation-message', text: r.message }));
          group.appendChild(item);
        });
        list.appendChild(group);
      });
    }

    openValidationPanel();
  }

  function openValidationPanel() {
    if (ui.validationEl) ui.validationEl.style.display = '';
  }
  function closeValidationPanel() {
    if (ui.validationEl) ui.validationEl.style.display = 'none';
  }

  // --------------------------------------------------------------------
  // PDF-voorbeeld en -export
  // --------------------------------------------------------------------

  function buildPdfModal() {
    var overlay = $('div', { class: 'mb-modal-overlay', id: 'mbPdfModalOverlay' });
    overlay.style.display = 'none';
    var modal = $('div', { class: 'mb-modal mb-modal-large' });
    var header = $('div', { class: 'mb-modal-header' });
    header.appendChild($('div', { text: 'Voorbeeld PDF', class: 'mb-modal-title' }));
    var closeBtn = $('button', { type: 'button', class: 'mb-btn mb-btn-small', text: 'Sluiten' });
    closeBtn.addEventListener('click', closePdfPreview);
    header.appendChild(closeBtn);
    modal.appendChild(header);
    var note = $('div', { class: 'mb-modal-note',
      text: 'Dit is een benadering van de PDF-uitvoer (geen pixel-perfecte native render). Gebruik "PDF genereren" voor de definitieve versie.' });
    modal.appendChild(note);
    var iframeWrap = $('div', { class: 'mb-modal-iframe-wrap' });
    var iframe = $('iframe', { id: 'mbPdfPreviewFrame', class: 'mb-pdf-preview-frame' });
    iframeWrap.appendChild(iframe);
    modal.appendChild(iframeWrap);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    ui.pdfModalEl = overlay;
  }

  /**
   * Bouwt een zo-goed-mogelijke print-benadering in een iframe: kopieert de
   * huidige (met overrides toegepaste) #rptStage-HTML plus alle <style>-
   * regels van de hoofdpagina. Dit is een bekende Fase-1-beperking: geen
   * native PDF-rendering, puur een visuele benadering in de browser.
   */
  function openPdfPreview() {
    var MB = core();
    if (!MB || !ui.stageEl) { toast('Rapport niet gevonden.', 'error'); return; }
    MB.applyOverridesToDom();

    var iframe = document.getElementById('mbPdfPreviewFrame');
    if (!iframe) return;
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();

    // verzamel alle <style>- en <link rel=stylesheet>-tags van de hoofdpagina
    var styleTags = Array.prototype.map.call(document.querySelectorAll('style'), function (s) { return s.outerHTML; }).join('\n');
    var linkTags = Array.prototype.map.call(document.querySelectorAll('link[rel="stylesheet"]'), function (l) { return l.outerHTML; }).join('\n');

    var stageClone = ui.stageEl.cloneNode(true);
    // verwijder editor-chrome-restjes uit de kloon (handles, hover/selectie-klassen)
    stageClone.querySelectorAll('.mb-drag-handle, .mb-handle, .mb-overflow-warning').forEach(function (x) { x.remove(); });
    stageClone.querySelectorAll('.mb-hover, .mb-selected').forEach(function (x) {
      x.classList.remove('mb-hover', 'mb-selected');
    });

    doc.write('<!DOCTYPE html><html><head><meta charset="utf-8">' + linkTags + styleTags + '</head><body>' + stageClone.outerHTML + '</body></html>');
    doc.close();

    ui.pdfModalEl.style.display = 'flex';
  }

  function closePdfPreview() {
    if (ui.pdfModalEl) ui.pdfModalEl.style.display = 'none';
  }

  function generatePdf() {
    var MB = core();
    if (MB) MB.applyOverridesToDom();
    if (typeof printReport === 'function') {
      printReport();
    } else {
      console.warn('[MBEditorUI] printReport() is niet beschikbaar, val terug op window.print().');
      window.print();
    }
  }

  // --------------------------------------------------------------------
  // Opslaan / herstellen / autosave
  // --------------------------------------------------------------------

  function saveReport(manual) {
    var MB = core();
    if (!MB) return;
    var record = MB.serializer.save(MB.state.dossierId);
    if (manual) toast('Rapport opgeslagen.', 'success');
    return record;
  }

  function restoreReport() {
    var MB = core();
    if (!MB) return;
    var ok = window.confirm('Alle bewerkingen in dit rapport verwijderen? Dit kan niet ongedaan gemaakt worden via undo na een pagina-herlaad.');
    if (!ok) return;
    MB.state.overrides = {};
    MB.pushHistory();
    if (typeof renderReport === 'function' && typeof currentData !== 'undefined') {
      renderReport(currentData);
    } else {
      // val terug op: verwijder alle inline styles/attrs die door de editor gezet zijn
      if (ui.stageEl) {
        ui.stageEl.querySelectorAll('[data-mb-applied]').forEach(function (el) {
          el.removeAttribute('style');
          el.removeAttribute('data-mb-applied');
        });
      }
    }
    clearSelection();
    refreshPageNav();
    toast('Rapport hersteld naar de standaardweergave.', 'success');
  }

  function restorePage() {
    var MB = core();
    if (!MB) return;
    var pageNum = getCurrentVisiblePageNumber();
    var removed = 0;
    Object.keys(MB.state.overrides).forEach(function (fieldId) {
      if (MB.state.overrides[fieldId].page === pageNum) {
        delete MB.state.overrides[fieldId];
        removed++;
      }
    });
    MB.applyOverridesToDom();
    MB.pushHistory();
    clearSelection();
    toast(removed + ' bewerking(en) op pagina ' + pageNum + ' hersteld.', 'success');
  }

  /** Bepaalt de "huidige" pagina op basis van de eerst geselecteerde kaart, of anders pagina 1. */
  function getCurrentVisiblePageNumber() {
    var list = document.getElementById('mbPageNavList');
    if (list) {
      var active = list.querySelector('.mb-page-card-active');
      if (active) return parseInt(active.getAttribute('data-page'), 10);
    }
    var MB = core();
    if (MB && MB.state.selection.length === 1) {
      var el = findElementByField(MB.state.selection[0]);
      if (el) return MB._internal.findPageNumber(el);
    }
    return 1;
  }

  function saveAsTemplateFlow() {
    var MB = core();
    if (!MB) return;
    var name = window.prompt('Naam voor dit sjabloon:', 'Nieuw sjabloon');
    if (!name) return;
    MB.serializer.exportTemplate(name, MB.state.overrides);
    toast('Sjabloon "' + name + '" opgeslagen.', 'success');
  }

  /** Gedebouncete autosave: elke pushHistory()-actie triggert dit (via wrapper hieronder). */
  function scheduleAutosave() {
    if (ui.autosaveTimer) clearTimeout(ui.autosaveTimer);
    ui.autosaveTimer = setTimeout(function () {
      var MB = core();
      if (MB && MB.state.active) {
        MB.serializer.save(MB.state.dossierId);
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  // --------------------------------------------------------------------
  // Export
  // --------------------------------------------------------------------

  window.MBEditorUI = {
    mount: mount,
    unmount: unmount,
    refreshPageNav: refreshPageNav,
    openValidationPanel: openValidationPanel,
    closeValidationPanel: closeValidationPanel,
    openPdfPreview: openPdfPreview,
    closePdfPreview: closePdfPreview,
    toast: toast
  };
})();
