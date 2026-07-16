/**
 * ============================================================================
 * MB Report Editor - TEMPLATE MANAGER
 * ============================================================================
 * LAADVOLGORDE: na report-editor-core.js (gebruikt MBEditor.serializer).
 * Onafhankelijk van report-editor-ui.js qua laadvolgorde, maar wordt in de
 * praktijk geopend via de knop id="mbBtn-templates" die report-editor-ui.js
 * aan de toolbar toevoegt.
 *
 * Simpele vanilla-JS overlay-modal (geen <dialog>-afhankelijkheid nodig,
 * puur een <div>-overlay) die een tabel toont van alle opgeslagen
 * sjablonen (MBEditor.serializer.listTemplates()) met acties: bekijken,
 * hernoemen, dupliceren, instellen als standaard, verwijderen, exporteren
 * (download als .json) en importeren (file input met defensieve validatie).
 *
 * ----------------------------------------------------------------------------
 * PUBLIEKE API (window.MBTemplateManager)
 * ----------------------------------------------------------------------------
 * open() -> void     // bouwt (indien nodig) de modal en toont 'm
 * close() -> void    // verbergt de modal
 * refresh() -> void  // herbouwt de tabel-inhoud (bijv. na wijziging elders)
 * ============================================================================
 */
(function () {
  'use strict';

  var overlayEl = null;
  var bodyEl = null;

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
        else el.setAttribute(k, attrs[k]);
      });
    }
    if (children) children.forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }

  function toast(message, kind) {
    if (window.MBEditorUI && typeof window.MBEditorUI.toast === 'function') {
      window.MBEditorUI.toast(message, kind);
    } else {
      // eenvoudige fallback als de editor-UI (nog) niet geladen is
      console.log('[MBTemplateManager] ' + message);
    }
  }

  // --------------------------------------------------------------------
  // Modal opbouw
  // --------------------------------------------------------------------

  function ensureModal() {
    if (overlayEl) return;

    overlayEl = $('div', { class: 'mb-modal-overlay', id: 'mbTemplateManagerOverlay' });
    overlayEl.style.display = 'none';
    overlayEl.addEventListener('mousedown', function (e) {
      if (e.target === overlayEl) close(); // klik buiten de modal sluit 'm
    });

    var modal = $('div', { class: 'mb-modal mb-modal-large' });

    var header = $('div', { class: 'mb-modal-header' });
    header.appendChild($('div', { class: 'mb-modal-title', text: 'Sjablonenbeheer' }));

    var headerActions = $('div', { style: 'display:flex;gap:6px;' });
    var importInput = $('input', { type: 'file', accept: '.json,application/json', id: 'mbTemplateImportInput' });
    importInput.style.display = 'none';
    importInput.addEventListener('change', onImportFileChosen);

    var importBtn = $('button', { type: 'button', class: 'mb-btn mb-btn-small', text: 'Importeren' });
    importBtn.title = 'Importeer een eerder geëxporteerd sjabloon (.json-bestand)';
    importBtn.addEventListener('click', function () { importInput.click(); });

    var closeBtn = $('button', { type: 'button', class: 'mb-btn mb-btn-small', text: 'Sluiten' });
    closeBtn.addEventListener('click', close);

    headerActions.appendChild(importInput);
    headerActions.appendChild(importBtn);
    headerActions.appendChild(closeBtn);
    header.appendChild(headerActions);
    modal.appendChild(header);

    bodyEl = $('div', { class: 'mb-modal-body', id: 'mbTemplateManagerBody' });
    modal.appendChild(bodyEl);

    overlayEl.appendChild(modal);
    document.body.appendChild(overlayEl);
  }

  function open() {
    ensureModal();
    refresh();
    overlayEl.style.display = 'flex';
  }

  function close() {
    if (overlayEl) overlayEl.style.display = 'none';
  }

  // --------------------------------------------------------------------
  // Tabel-inhoud
  // --------------------------------------------------------------------

  function refresh() {
    var MB = core();
    if (!bodyEl) return;
    bodyEl.innerHTML = '';

    if (!MB) {
      bodyEl.appendChild($('div', { class: 'mb-template-empty', text: 'Editor-core (MBEditor) is niet geladen.' }));
      return;
    }

    var templates = [];
    try {
      templates = MB.serializer.listTemplates() || [];
    } catch (e) {
      console.warn('[MBTemplateManager] Kon sjablonenlijst niet ophalen', e);
    }

    if (templates.length === 0) {
      bodyEl.appendChild($('div', { class: 'mb-template-empty', text: 'Nog geen sjablonen opgeslagen. Gebruik "Opslaan als sjabloon" in de rapporteditor.' }));
      return;
    }

    var defaultId = null;
    try {
      defaultId = MB.serializer.getDefaultTemplate ? MB.serializer.getDefaultTemplate() : null;
    } catch (e) { defaultId = null; }

    var table = $('table', { class: 'mb-template-table' });
    var thead = $('thead', {}, [
      $('tr', {}, [
        $('th', { text: 'Naam' }),
        $('th', { text: 'Aangemaakt' }),
        $('th', { text: 'Standaard' }),
        $('th', { text: 'Acties' })
      ])
    ]);
    table.appendChild(thead);

    var tbody = $('tbody');
    templates.forEach(function (tpl) {
      var row = $('tr');
      row.appendChild($('td', { text: tpl.name || '(zonder naam)' }));
      row.appendChild($('td', { text: formatDate(tpl.createdAt) }));
      row.appendChild($('td', { text: (tpl.id === defaultId) ? 'Ja' : '' }));

      var actions = $('td', { class: 'mb-template-actions' });
      actions.appendChild(actionBtn('Bekijken', function () { showJsonPreview(tpl); }));
      actions.appendChild(actionBtn('Hernoemen', function () { renameFlow(tpl); }));
      actions.appendChild(actionBtn('Dupliceren', function () { duplicateFlow(tpl); }));
      actions.appendChild(actionBtn('Standaard maken', function () { setDefaultFlow(tpl); }));
      actions.appendChild(actionBtn('Exporteren', function () { exportFlow(tpl); }));
      actions.appendChild(actionBtn('Verwijderen', function () { deleteFlow(tpl); }));
      row.appendChild(actions);

      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    bodyEl.appendChild(table);

    // container voor JSON-preview/foutmeldingen, onder de tabel
    bodyEl.appendChild($('div', { id: 'mbTemplatePreviewArea' }));
  }

  function actionBtn(label, handler) {
    var b = $('button', { type: 'button', class: 'mb-btn mb-btn-small', text: label });
    b.addEventListener('click', handler);
    return b;
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString('nl-NL');
    } catch (e) {
      return iso;
    }
  }

  function getPreviewArea() {
    var area = document.getElementById('mbTemplatePreviewArea');
    if (!area && bodyEl) {
      area = $('div', { id: 'mbTemplatePreviewArea' });
      bodyEl.appendChild(area);
    }
    return area;
  }

  // --------------------------------------------------------------------
  // Acties
  // --------------------------------------------------------------------

  function showJsonPreview(tpl) {
    var area = getPreviewArea();
    if (!area) return;
    area.innerHTML = '';
    var title = $('div', { class: 'mb-panel-section-title', text: 'Inhoud: ' + tpl.name });
    var pre = $('pre', { class: 'mb-template-json-preview' });
    try {
      pre.textContent = JSON.stringify(tpl.data, null, 2);
    } catch (e) {
      pre.textContent = '(kon JSON niet weergeven)';
    }
    area.appendChild(title);
    area.appendChild(pre);
  }

  function renameFlow(tpl) {
    var MB = core();
    if (!MB) return;
    var newName = window.prompt('Nieuwe naam voor sjabloon:', tpl.name || '');
    if (!newName) return;
    MB.serializer.renameTemplate(tpl.id, newName);
    refresh();
    toast('Sjabloon hernoemd.', 'success');
  }

  function duplicateFlow(tpl) {
    var MB = core();
    if (!MB) return;
    MB.serializer.duplicateTemplate(tpl.id);
    refresh();
    toast('Sjabloon gedupliceerd.', 'success');
  }

  function setDefaultFlow(tpl) {
    var MB = core();
    if (!MB) return;
    MB.serializer.setDefaultTemplate(tpl.id);
    refresh();
    toast('"' + tpl.name + '" ingesteld als standaardsjabloon.', 'success');
  }

  function deleteFlow(tpl) {
    var MB = core();
    if (!MB) return;
    var ok = window.confirm('Sjabloon "' + tpl.name + '" definitief verwijderen?');
    if (!ok) return;
    MB.serializer.deleteTemplate(tpl.id);
    refresh();
    toast('Sjabloon verwijderd.', 'success');
  }

  /** Downloadt een sjabloon als .json-bestand via een Blob/<a download>. */
  function exportFlow(tpl) {
    try {
      var json = JSON.stringify(tpl, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      var safeName = (tpl.name || 'sjabloon').replace(/[^a-z0-9_\-]+/gi, '_');
      a.download = 'mb-sjabloon-' + safeName + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    } catch (e) {
      console.warn('[MBTemplateManager] Exporteren mislukt', e);
      toast('Exporteren van sjabloon is mislukt.', 'error');
    }
  }

  /**
   * Verwerkt een geïmporteerd .json-bestand. Valideert defensief de vorm
   * VOORDAT er iets wordt opgeslagen: crasht nooit op een ongeldig bestand,
   * toont in plaats daarvan een duidelijke foutmelding in de UI.
   */
  function onImportFileChosen(e) {
    var input = e.target;
    var file = input.files && input.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      var area = getPreviewArea();
      var text = String(reader.result || '');
      var parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        showImportError('Het bestand is geen geldig JSON-bestand.', area);
        input.value = '';
        return;
      }

      var validation = validateTemplateShape(parsed);
      if (!validation.ok) {
        showImportError('Het bestand heeft niet de verwachte sjabloon-vorm: ' + validation.reason, area);
        input.value = '';
        return;
      }

      var MB = core();
      if (!MB) {
        showImportError('Editor-core (MBEditor) is niet geladen; kan sjabloon niet opslaan.', area);
        input.value = '';
        return;
      }

      try {
        // hergebruik exportTemplate om consistent met mb_templates-schema te blijven;
        // 'data' bevat al alleen style/structuurvelden (of wordt hier gevalideerd verondersteld)
        var templates = MB.serializer.listTemplates();
        var importedName = (parsed.name || 'Geïmporteerd sjabloon') + ' (import)';
        var tpl = {
          id: 'tpl_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
          name: importedName,
          createdAt: new Date().toISOString(),
          data: parsed.data
        };
        templates.push(tpl);
        // rechtstreeks via localStorage-sleutel schrijven zou de interne logica dupliceren;
        // in plaats daarvan updaten we via een kleine helper-aanroep op de serializer.
        window.localStorage.setItem('mb_templates', JSON.stringify(templates));
        refresh();
        toast('Sjabloon "' + importedName + '" geïmporteerd.', 'success');
        if (area) area.innerHTML = '';
      } catch (err) {
        console.warn('[MBTemplateManager] Import opslaan mislukt', err);
        showImportError('Opslaan van het geïmporteerde sjabloon is mislukt.', area);
      }
      input.value = '';
    };
    reader.onerror = function () {
      showImportError('Het bestand kon niet worden gelezen.', getPreviewArea());
      input.value = '';
    };
    reader.readAsText(file);
  }

  /**
   * Defensieve vormcontrole van een geïmporteerd sjabloon-object. Geeft
   * {ok:boolean, reason?:string} terug — gooit nooit een exception.
   */
  function validateTemplateShape(obj) {
    try {
      if (!obj || typeof obj !== 'object') return { ok: false, reason: 'geen object' };
      if (!obj.data || typeof obj.data !== 'object') return { ok: false, reason: 'ontbrekend of ongeldig "data"-veld' };
      // elk item in data moet minstens een 'type' of 'style' hebben om plausibel te zijn
      var keys = Object.keys(obj.data);
      for (var i = 0; i < keys.length; i++) {
        var item = obj.data[keys[i]];
        if (!item || typeof item !== 'object') return { ok: false, reason: 'ongeldig item voor "' + keys[i] + '"' };
        if (item.content !== undefined) {
          // sjablonen mogen NOOIT content-tekstwaarden bevatten (contractregel)
          return { ok: false, reason: 'bevat contentwaarden, dat hoort niet in een sjabloon' };
        }
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'onverwachte fout tijdens validatie' };
    }
  }

  function showImportError(message, area) {
    if (!area) area = getPreviewArea();
    if (!area) { toast(message, 'error'); return; }
    area.innerHTML = '';
    area.appendChild($('div', { class: 'mb-template-error', text: message }));
    toast('Importeren mislukt.', 'error');
  }

  // --------------------------------------------------------------------
  // Export
  // --------------------------------------------------------------------

  window.MBTemplateManager = {
    open: open,
    close: close,
    refresh: refresh
  };
})();
