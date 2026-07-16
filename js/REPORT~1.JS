/**
 * ============================================================================
 * MB Report Editor - CORE
 * ============================================================================
 * Zelfstandig, framework-loos JS-bestand. Definieert window.MBEditor.
 * Moet ALS EERSTE geladen worden, vóór report-editor-ui.js
 * (die bouwt verder op window.MBEditor).
 *
 * BELANGRIJK: dit bestand praat met een aantal globals die pas in de
 * integratiestap aanwezig zijn in de host-pagina (index.html):
 *   - let currentData                     -> canoniek rapport-databject "d"
 *   - function renderReport(d)            -> herbouwt #rptStage vanuit d
 *   - function fitAllPagesToA4()          -> past compact-klassen toe, retourneert
 *                                             array van {page, overflowPx}
 *   - function runLayoutQualityChecks()   -> DOM-validatie, retourneert array
 *                                             van {code, severity, message, page?}
 *   - function runQualityChecks(d)        -> data-validatie, zelfde vorm
 *   - function printReport()              -> herberekent fit + checks, window.print()
 * Geen van deze globals wordt hier gegarandeerd verondersteld te bestaan.
 * Elke aanroep gebeurt defensief via typeof-checks, zodat dit bestand
 * foutloos laadt en werkt in een lege/losse testomgeving.
 *
 * ----------------------------------------------------------------------------
 * PUBLIEKE API (window.MBEditor)
 * ----------------------------------------------------------------------------
 * state: {
 *   active: boolean,            // is editmodus aan
 *   mode: 'content'|'design',   // huidige editor-submodus
 *   selection: string[],        // geselecteerde data-field waarden
 *   overrides: Object,          // keyed op data-field, zie createDefaultOverride()
 *   dirty: boolean,             // zijn er onopgeslagen wijzigingen
 *   dossierId: string|null      // huidige dossier-sleutel
 * }
 *
 * createDefaultOverride(type, page) -> Object
 *   Bouwt een leeg override-object volgens het vaste opslagschema.
 *
 * getOverride(fieldId, type, page) -> Object
 *   Haalt bestaande override op of maakt (en registreert) een nieuwe aan.
 *
 * applyOverridesToDom() -> void
 *   Loopt over alle [data-field]-elementen in #rptStage en past de
 *   bijbehorende override toe (tekst, stijl, zichtbaarheid, positionering).
 *   Nooit fataal: ontbrekende elementen worden overgeslagen.
 *
 * captureBaseline(fieldId, el) -> Object
 *   Leest de huidige gerenderde stijl/tekst van een element uit zodat het
 *   eigenschappenpaneel met echte waarden kan starten. Retourneert de
 *   uitgelezen baseline (wijzigt de override niet, tenzij nog geen override
 *   bestond -> dan wordt er een lege aangemaakt met type/page geraden).
 *
 * pushHistory() -> void
 *   Legt een snapshot van {overrides, selection} vast (max 100 stappen).
 * undo() -> boolean            // true als er iets is teruggedraaid
 * redo() -> boolean
 * canUndo() -> boolean
 * canRedo() -> boolean
 *
 * serializer (MBEditor.serializer):
 *   save(dossierId) -> Object                  // het opgeslagen record
 *   load(dossierId) -> Object|null              // null bij ontbreken/corrupt
 *   deriveDossierId(d) -> string
 *   listVersions(dossierId) -> Array
 *   saveVersion(dossierId, record) -> void
 *   restoreVersion(dossierId, versionTimestamp) -> Object|null
 *   exportTemplate(name, overrides) -> Object   // ook opgeslagen in mb_templates
 *   listTemplates() -> Array
 *   deleteTemplate(id) -> void
 *   renameTemplate(id, newName) -> void
 *   duplicateTemplate(id) -> Object|null
 *   setDefaultTemplate(id) -> void
 *   applyTemplate(id) -> boolean                // merget in MBEditor.state.overrides
 *
 * overflowChecker (MBEditor.overflowChecker):
 *   check() -> Array<{code, severity, message, page}>
 *
 * validation (MBEditor.validation):
 *   runAll() -> Array<{code, severity, message, page}>
 *
 * hashString(str) -> string     // simpele, snelle niet-cryptografische hash
 * ============================================================================
 */
(function () {
  'use strict';

  // --------------------------------------------------------------------
  // Constanten
  // --------------------------------------------------------------------
  var PAGE_WIDTH_MM = 210;
  var PAGE_HEIGHT_MM = 297;
  var SAFE_MARGIN_MM = 10;
  var MAX_HISTORY = 100;
  var SCHEMA_VERSION = 1;
  var MAX_VERSIONS = 20;

  // --------------------------------------------------------------------
  // Interne state
  // --------------------------------------------------------------------
  var state = {
    active: false,
    mode: 'content', // 'content' | 'design'
    selection: [],
    overrides: {},
    dirty: false,
    dossierId: null
  };

  // Undo/redo-stacks (los van state zelf, houden snapshots vast)
  var undoStack = [];
  var redoStack = [];

  // --------------------------------------------------------------------
  // Hulpfuncties: klonen, hashen, veilig JSON
  // --------------------------------------------------------------------

  /**
   * Diepe kloon met voorkeur voor structuredClone, met JSON-fallback.
   * Wordt gebruikt voor undo/redo-snapshots en export.
   */
  function deepClone(obj) {
    try {
      if (typeof structuredClone === 'function') {
        return structuredClone(obj);
      }
    } catch (e) {
      // val terug op JSON-methode
    }
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      console.warn('[MBEditor] deepClone mislukt, geef leeg object terug', e);
      return {};
    }
  }

  /**
   * Simpele, snelle (niet-cryptografische) stringhash. Voldoende om te
   * detecteren of de onderliggende rapportdata is gewijzigd sinds de
   * laatste opgeslagen editorstate.
   */
  function hashString(str) {
    str = String(str == null ? '' : str);
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var chr = str.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0; // forceer 32-bit integer
    }
    // ook een simpele charcode-som meenemen als extra check (spec vraagt hier expliciet om)
    var sum = 0;
    for (var j = 0; j < str.length; j++) {
      sum += str.charCodeAt(j);
    }
    return 'h' + hash + '_s' + sum + '_l' + str.length;
  }

  /** Veilig localStorage lezen; geeft null terug bij fouten (privémodus, quota, etc.) */
  function safeGetItem(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      console.warn('[MBEditor] localStorage.getItem mislukt voor sleutel', key, e);
      return null;
    }
  }

  /** Veilig localStorage schrijven; retourneert true/false */
  function safeSetItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn('[MBEditor] localStorage.setItem mislukt voor sleutel', key, e);
      return false;
    }
  }

  /** Veilig JSON parsen; geeft fallback terug bij fouten */
  function safeParse(str, fallback) {
    if (str == null) return fallback;
    try {
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
  }

  /** Haalt #rptStage op (of null als die (nog) niet bestaat) */
  function getStage() {
    return document.getElementById('rptStage');
  }

  // --------------------------------------------------------------------
  // Override-schema
  // --------------------------------------------------------------------

  /**
   * Bouwt een leeg override-object volgens het vaste contract-schema.
   * @param {string} type - 'text'|'amount'|'image'|'table'|'chart'|'block'
   * @param {number} page - paginanummer (1-gebaseerd)
   */
  function createDefaultOverride(type, page) {
    return {
      type: type || 'block',
      page: page || 1,
      content: {
        override: null,
        linkBroken: false
      },
      style: {
        x: null,
        y: null,
        w: null,
        h: null,
        color: null,
        bg: null,
        fontSize: null,
        fontWeight: null,
        fontStyle: null,
        textDecoration: null,
        textAlign: null,
        lineHeight: null,
        letterSpacing: null,
        textTransform: null,
        padding: null,
        margin: null,
        border: null,
        borderRadius: null,
        boxShadow: null,
        opacity: null,
        zIndex: null
      },
      visible: true,
      locked: false,
      order: null
    };
  }

  /** Haalt bestaande override op, of maakt (en registreert) een nieuwe aan. */
  function getOverride(fieldId, type, page) {
    if (!state.overrides[fieldId]) {
      state.overrides[fieldId] = createDefaultOverride(type, page);
    }
    return state.overrides[fieldId];
  }

  /** Bepaalt het paginanummer van een element op basis van de dichtstbijzijnde .a4.content-voorouder. */
  function findPageNumber(el) {
    var pageEl = el.closest ? el.closest('.a4.content') : null;
    if (!pageEl) return 1;
    var stage = getStage();
    if (!stage) return 1;
    var pages = stage.querySelectorAll('.a4.content');
    for (var i = 0; i < pages.length; i++) {
      if (pages[i] === pageEl) return i + 1;
    }
    return 1;
  }

  /** Raadt het elementtype op basis van tag/attributen, voor gebruik als er nog geen override bestaat. */
  function guessElementType(el) {
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'img') return 'image';
    if (tag === 'table') return 'table';
    if (el.hasAttribute && (el.hasAttribute('data-chart') || el.querySelector && el.querySelector('canvas,svg'))) {
      return 'chart';
    }
    var fieldAttr = el.getAttribute ? el.getAttribute('data-field') : '';
    if (fieldAttr && /capex|bedrag|totaal|_ton|percentage|%/i.test(fieldAttr)) return 'amount';
    if (fieldAttr && fieldAttr.indexOf('block:') === 0) return 'block';
    return 'text';
  }

  // --------------------------------------------------------------------
  // applyOverridesToDom
  // --------------------------------------------------------------------

  /**
   * Past alle geregistreerde overrides toe op de huidige DOM binnen #rptStage.
   * Idempotent en veilig: als een element niet (meer) bestaat wordt de
   * override simpelweg overgeslagen (bijv. na een databewerking die een
   * maatregel verwijderde).
   */
  function applyOverridesToDom() {
    var stage = getStage();
    if (!stage) return;

    var fieldIds = Object.keys(state.overrides);
    for (var i = 0; i < fieldIds.length; i++) {
      var fieldId = fieldIds[i];
      var ov = state.overrides[fieldId];
      if (!ov) continue;

      var el = null;
      try {
        el = stage.querySelector('[data-field="' + cssEscapeAttr(fieldId) + '"]');
      } catch (e) {
        // ongeldige selector (rare tekens in fieldId) -> overslaan, niet fataal
        el = null;
      }
      if (!el) continue; // element bestaat niet (meer) -> override negeren, geen crash

      applyOverrideToElement(el, ov, fieldId);
    }
  }

  /** Escaped een data-field waarde zodanig dat die veilig in een attribuutselector past. */
  function cssEscapeAttr(value) {
    if (typeof CSS !== 'undefined' && CSS.escape) {
      // CSS.escape werkt op identifiers; voor attribuutwaarden binnen quotes hoeven
      // we alleen de quote en backslash te ontsnappen.
      return String(value).replace(/(["\\])/g, '\\$1');
    }
    return String(value).replace(/(["\\])/g, '\\$1');
  }

  /** Past één override toe op één element. */
  function applyOverrideToElement(el, ov, fieldId) {
    // --- zichtbaarheid ---
    if (ov.visible === false) {
      el.style.display = 'none';
      // als het element verborgen is heeft verdere styling geen zin, maar we
      // passen 'm toch toe zodat de staat consistent blijft mocht het weer
      // zichtbaar worden gemaakt.
    } else {
      // alleen expliciet terugzetten als wij eerder 'none' hebben gezet
      if (el.style.display === 'none') {
        el.style.display = '';
      }
    }

    // --- tekstinhoud ---
    if (ov.content && ov.content.override != null) {
      var textNode = el.querySelector ? el.querySelector('[data-mb-text]') : null;
      if (textNode) {
        textNode.textContent = ov.content.override;
      } else if (el.children && el.children.length > 0) {
        // complexer element met kinderen: gebruik innerText om opmaak van
        // kindnodes zo veel mogelijk te behouden (innerText herschrijft
        // alleen de zichtbare tekst, niet per se de kindstructuur, maar dit
        // is de best haalbare aanpak zonder een dedicated tekstnode-marker).
        el.innerText = ov.content.override;
      } else {
        el.textContent = ov.content.override;
      }
    }

    // --- stijl ---
    var s = ov.style || {};
    var styleMap = {
      color: 'color',
      bg: 'backgroundColor',
      fontSize: 'fontSize',
      fontWeight: 'fontWeight',
      fontStyle: 'fontStyle',
      textDecoration: 'textDecoration',
      textAlign: 'textAlign',
      lineHeight: 'lineHeight',
      letterSpacing: 'letterSpacing',
      textTransform: 'textTransform',
      padding: 'padding',
      margin: 'margin',
      border: 'border',
      borderRadius: 'borderRadius',
      boxShadow: 'boxShadow',
      opacity: 'opacity',
      zIndex: 'zIndex'
    };
    Object.keys(styleMap).forEach(function (key) {
      var cssProp = styleMap[key];
      var val = s[key];
      if (val !== null && val !== undefined && val !== '') {
        el.style[cssProp] = val;
      }
    });

    // --- positionering (loskoppelen van de normale flow) ---
    if (s.x != null || s.y != null) {
      el.style.position = 'absolute';
      if (s.x != null) el.style.left = toMm(s.x);
      if (s.y != null) el.style.top = toMm(s.y);

      // forceer position:relative op de dichtstbijzijnde .a4.content-voorouder
      // zodat de absolute coördinaten kloppen t.o.v. de paginarand.
      var pageEl = el.closest ? el.closest('.a4.content') : null;
      if (pageEl) {
        pageEl.classList.add('mb-positioning-context');
      }
    }
    if (s.w != null) el.style.width = toMm(s.w);
    if (s.h != null) el.style.height = toMm(s.h);

    // markeer het element met het fieldId als data-attribuut voor eventuele
    // CSS-hooks/debugging (geen functionele impact op het rapport zelf).
    if (el.getAttribute && el.getAttribute('data-mb-applied') !== fieldId) {
      el.setAttribute('data-mb-applied', fieldId);
    }
  }

  /** Zet een numerieke mm-waarde (of iets dat al een eenheid heeft) om naar een CSS-lengtewaarde. */
  function toMm(val) {
    if (typeof val === 'number') return val + 'mm';
    if (typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val.trim())) return val.trim() + 'mm';
    return val; // bevat waarschijnlijk al een eenheid
  }

  // --------------------------------------------------------------------
  // captureBaseline
  // --------------------------------------------------------------------

  /**
   * Leest de huidige gerenderde stijl/tekst van een element uit (via
   * getComputedStyle + textContent) zodra het voor het eerst geselecteerd
   * wordt. Zo begint het eigenschappenpaneel met de echte huidige waarde
   * i.p.v. leeg. Wijzigt geen bestaande override-waarden die de gebruiker
   * al expliciet heeft gezet (die blijven leidend); vult alleen aan als er
   * nog geen override bestond.
   */
  function captureBaseline(fieldId, el) {
    if (!el) return null;
    var isNew = !state.overrides[fieldId];
    var type = guessElementType(el);
    var page = findPageNumber(el);
    var ov = getOverride(fieldId, type, page);

    var computed = null;
    try {
      computed = window.getComputedStyle(el);
    } catch (e) {
      computed = null;
    }

    var baseline = {
      text: el.textContent != null ? el.textContent.trim() : '',
      color: computed ? computed.color : null,
      backgroundColor: computed ? computed.backgroundColor : null,
      fontSize: computed ? computed.fontSize : null,
      fontWeight: computed ? computed.fontWeight : null,
      textAlign: computed ? computed.textAlign : null
    };

    // sla de baseline op als referentie (niet als "override", puur informatief)
    ov.__baseline = baseline;

    if (isNew) {
      // nieuw aangemaakte override: laat content.override bewust null
      // (= "geen wijziging"), het paneel toont de baseline-tekst apart.
    }

    return baseline;
  }

  // --------------------------------------------------------------------
  // Undo / redo
  // --------------------------------------------------------------------

  /** Legt een snapshot van {overrides, selection} vast op de undo-stack. */
  function pushHistory() {
    var snapshot = {
      overrides: deepClone(state.overrides),
      selection: deepClone(state.selection)
    };
    undoStack.push(snapshot);
    if (undoStack.length > MAX_HISTORY) {
      undoStack.shift(); // oudste eruit
    }
    // elke nieuwe actie maakt de redo-stack ongeldig
    redoStack = [];
    state.dirty = true;
  }

  function canUndo() {
    return undoStack.length > 0;
  }

  function canRedo() {
    return redoStack.length > 0;
  }

  /** Draait de laatste wijziging terug. Retourneert true als er iets is teruggedraaid. */
  function undo() {
    if (undoStack.length === 0) return false;
    // huidige staat naar redo-stack, zodat 'redo' weer vooruit kan
    var current = {
      overrides: deepClone(state.overrides),
      selection: deepClone(state.selection)
    };
    redoStack.push(current);

    var prev = undoStack.pop();
    state.overrides = prev.overrides;
    state.selection = prev.selection;
    state.dirty = true;
    applyOverridesToDom();
    return true;
  }

  /** Voert een eerder teruggedraaide wijziging opnieuw uit. */
  function redo() {
    if (redoStack.length === 0) return false;
    var current = {
      overrides: deepClone(state.overrides),
      selection: deepClone(state.selection)
    };
    undoStack.push(current);

    var next = redoStack.pop();
    state.overrides = next.overrides;
    state.selection = next.selection;
    state.dirty = true;
    applyOverridesToDom();
    return true;
  }

  // --------------------------------------------------------------------
  // ReportSerializer
  // --------------------------------------------------------------------

  var serializer = {
    /**
     * Bouwt een stabiele dossier-sleutel uit adres + naam (+ datum indien
     * aanwezig). Lowercase, whitespace genormaliseerd. Als beide adres en
     * naam ontbreken: fallback op een tijdstip-gebaseerde random id, met
     * een console.warn dat er geen stabiele dossierherkenning mogelijk is.
     */
    deriveDossierId: function (d) {
      d = d || {};
      var adres = (d.object_adres || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
      var naam = (d.object_naam || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
      var datum = (d.datum_rapport || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

      if (!adres && !naam) {
        console.warn('[MBEditor] Geen object_adres of object_naam aanwezig; geen stabiele ' +
          'dossierherkenning mogelijk. Er wordt een tijdelijke, niet-stabiele id gebruikt.');
        return 'dossier_tmp_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
      }

      var raw = [naam, adres, datum].filter(Boolean).join('|');
      return 'dossier_' + hashString(raw);
    },

    /**
     * Serialiseert de huidige editorstate naar localStorage.
     * @param {string} dossierId
     * @returns {Object} het opgeslagen record
     */
    save: function (dossierId) {
      dossierId = dossierId || state.dossierId;
      if (!dossierId) {
        console.warn('[MBEditor] serializer.save: geen dossierId beschikbaar, sla op onder een fallback-sleutel.');
        dossierId = 'dossier_unknown';
      }

      var currentDataRef = (typeof currentData !== 'undefined') ? currentData : null;
      var baseDataHash = hashString(safeStringify(currentDataRef));

      var record = {
        dossierId: dossierId,
        baseDataHash: baseDataHash,
        lastModified: new Date().toISOString(),
        elements: deepClone(state.overrides),
        pages: {
          order: state.pageOrder || null,
          hidden: state.hiddenPages || [],
          headerFooterMode: state.headerFooterMode || 'default'
        },
        schemaVersion: SCHEMA_VERSION
      };

      var ok = safeSetItem('mb_report_edits_' + dossierId, JSON.stringify(record));
      if (ok) {
        state.dirty = false;
        // schrijf ook een versiekopie weg voor de versiegeschiedenis
        this.saveVersion(dossierId, record);
      }
      return record;
    },

    /**
     * Leest editordata voor een dossier. Geeft NOOIT een exception, altijd
     * null bij ontbrekend/corrupt/oud schema (met console.warn).
     */
    load: function (dossierId) {
      if (!dossierId) {
        console.warn('[MBEditor] serializer.load: geen dossierId opgegeven.');
        return null;
      }
      var raw = safeGetItem('mb_report_edits_' + dossierId);
      if (!raw) {
        return null; // gewoon geen bewerkdata voor dit dossier -> stil, geen warn nodig
      }
      var parsed = safeParse(raw, null);
      if (!parsed || typeof parsed !== 'object') {
        console.warn('[MBEditor] serializer.load: opgeslagen data voor dossier "' + dossierId + '" is corrupt (parse mislukt).');
        return null;
      }
      if (parsed.schemaVersion !== SCHEMA_VERSION) {
        console.warn('[MBEditor] serializer.load: schemaVersion mismatch voor dossier "' + dossierId +
          '" (gevonden ' + parsed.schemaVersion + ', verwacht ' + SCHEMA_VERSION + '). Bewerkdata wordt genegeerd.');
        return null;
      }
      return parsed;
    },

    /** Retourneert de versiegeschiedenis (array), nieuwste laatst toegevoegd. */
    listVersions: function (dossierId) {
      var raw = safeGetItem('mb_report_versions_' + dossierId);
      var arr = safeParse(raw, []);
      return Array.isArray(arr) ? arr : [];
    },

    /** Voegt een timestamped kopie toe aan de versiegeschiedenis (max 20, oudste eruit). */
    saveVersion: function (dossierId, record) {
      var versions = this.listVersions(dossierId);
      versions.push({
        timestamp: new Date().toISOString(),
        data: deepClone(record)
      });
      while (versions.length > MAX_VERSIONS) {
        versions.shift();
      }
      safeSetItem('mb_report_versions_' + dossierId, JSON.stringify(versions));
    },

    /** Herstelt een specifieke versie (op timestamp) terug in state.overrides. Retourneert de herstelde record of null. */
    restoreVersion: function (dossierId, versionTimestamp) {
      var versions = this.listVersions(dossierId);
      var found = null;
      for (var i = 0; i < versions.length; i++) {
        if (versions[i].timestamp === versionTimestamp) {
          found = versions[i];
          break;
        }
      }
      if (!found || !found.data) {
        console.warn('[MBEditor] restoreVersion: versie niet gevonden voor timestamp', versionTimestamp);
        return null;
      }
      state.overrides = deepClone(found.data.elements || {});
      state.dirty = true;
      return found.data;
    },

    /**
     * Bouwt een sjabloon-object dat UITSLUITEND style/structuurvelden bevat.
     * content.override-tekstwaarden en dossier-specifieke bedragen worden
     * nooit meegenomen.
     */
    exportTemplate: function (name, overrides) {
      var stripped = {};
      Object.keys(overrides || {}).forEach(function (fieldId) {
        var ov = overrides[fieldId];
        if (!ov) return;
        stripped[fieldId] = {
          type: ov.type,
          page: ov.page,
          style: deepClone(ov.style || {}),
          visible: ov.visible,
          locked: ov.locked,
          order: ov.order
          // let op: bewust GEEN 'content' veld hier
        };
      });

      var templates = this.listTemplates();
      var tpl = {
        id: 'tpl_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
        name: name || 'Naamloos sjabloon',
        createdAt: new Date().toISOString(),
        data: stripped
      };
      templates.push(tpl);
      safeSetItem('mb_templates', JSON.stringify(templates));
      return tpl;
    },

    listTemplates: function () {
      var raw = safeGetItem('mb_templates');
      var arr = safeParse(raw, []);
      return Array.isArray(arr) ? arr : [];
    },

    deleteTemplate: function (id) {
      var templates = this.listTemplates().filter(function (t) { return t.id !== id; });
      safeSetItem('mb_templates', JSON.stringify(templates));
    },

    renameTemplate: function (id, newName) {
      var templates = this.listTemplates();
      var t = templates.find(function (t) { return t.id === id; });
      if (t) {
        t.name = newName;
        safeSetItem('mb_templates', JSON.stringify(templates));
      }
    },

    duplicateTemplate: function (id) {
      var templates = this.listTemplates();
      var t = templates.find(function (t) { return t.id === id; });
      if (!t) return null;
      var copy = deepClone(t);
      copy.id = 'tpl_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
      copy.name = t.name + ' (kopie)';
      copy.createdAt = new Date().toISOString();
      templates.push(copy);
      safeSetItem('mb_templates', JSON.stringify(templates));
      return copy;
    },

    setDefaultTemplate: function (id) {
      safeSetItem('mb_default_template', id);
    },

    getDefaultTemplate: function () {
      return safeGetItem('mb_default_template');
    },

    /**
     * Merget de style-waarden van een sjabloon in de huidige overrides,
     * met behoud van bestaande content-waarden.
     */
    applyTemplate: function (id) {
      var templates = this.listTemplates();
      var t = templates.find(function (t) { return t.id === id; });
      if (!t) {
        console.warn('[MBEditor] applyTemplate: sjabloon niet gevonden', id);
        return false;
      }
      Object.keys(t.data || {}).forEach(function (fieldId) {
        var tplOv = t.data[fieldId];
        var existing = state.overrides[fieldId] || createDefaultOverride(tplOv.type, tplOv.page);
        existing.style = Object.assign({}, existing.style, tplOv.style);
        existing.visible = (tplOv.visible !== undefined) ? tplOv.visible : existing.visible;
        existing.locked = (tplOv.locked !== undefined) ? tplOv.locked : existing.locked;
        existing.order = (tplOv.order !== undefined) ? tplOv.order : existing.order;
        state.overrides[fieldId] = existing;
      });
      state.dirty = true;
      return true;
    }
  };

  /** Veilig stringify (voor hashing), vangt cirkelverwijzingen/exceptions af. */
  function safeStringify(obj) {
    try {
      return JSON.stringify(obj) || '';
    } catch (e) {
      return '';
    }
  }

  // --------------------------------------------------------------------
  // OverflowChecker
  // --------------------------------------------------------------------

  var overflowChecker = {
    /**
     * Combineert de bestaande globale layout-checks met twee eigen,
     * editor-specifieke checks (overlap en buiten-de-pagina).
     */
    check: function () {
      var results = [];

      // --- bestaande globale fit/overflow-check ---
      var fitResults = [];
      try {
        if (typeof fitAllPagesToA4 === 'function') {
          fitResults = fitAllPagesToA4() || [];
        }
      } catch (e) {
        console.warn('[MBEditor] fitAllPagesToA4() gaf een fout', e);
      }
      (fitResults || []).forEach(function (r) {
        if (r && r.overflowPx > 0) {
          results.push({
            code: 'PAGE_OVERFLOW',
            severity: 'error',
            message: 'Pagina ' + (r.page || '?') + ' heeft ' + Math.round(r.overflowPx) + 'px overflow.',
            page: r.page
          });
        }
      });

      // --- bestaande DOM-niveau kwaliteitschecks ---
      var layoutResults = [];
      try {
        if (typeof runLayoutQualityChecks === 'function') {
          layoutResults = runLayoutQualityChecks() || [];
        }
      } catch (e) {
        console.warn('[MBEditor] runLayoutQualityChecks() gaf een fout', e);
      }
      (layoutResults || []).forEach(function (r) {
        results.push(normalizeCheckResult(r));
      });

      // --- eigen editor-checks ---
      results = results.concat(checkOverlaps());
      results = results.concat(checkOutOfBounds());

      return results;
    }
  };

  /** Zorgt dat een extern check-resultaat altijd de verwachte vorm heeft. */
  function normalizeCheckResult(r) {
    return {
      code: r.code || 'UNKNOWN',
      severity: r.severity || 'warning',
      message: r.message || '',
      page: r.page
    };
  }

  /**
   * (a) Detecteert overlappende, absoluut gepositioneerde blokken binnen
   * dezelfde pagina, via bounding-box vergelijking.
   */
  function checkOverlaps() {
    var results = [];
    var stage = getStage();
    if (!stage) return results;

    var pages = stage.querySelectorAll('.a4.content');
    pages.forEach(function (pageEl, pageIdx) {
      var pageNum = pageIdx + 1;
      // alleen elementen die door ons zijn losgemaakt (position:absolute via override)
      var absEls = [];
      Object.keys(state.overrides).forEach(function (fieldId) {
        var ov = state.overrides[fieldId];
        if (!ov || ov.visible === false) return;
        if (ov.style.x == null && ov.style.y == null) return; // niet losgemaakt
        var el = null;
        try {
          el = pageEl.querySelector('[data-field="' + cssEscapeAttr(fieldId) + '"]');
        } catch (e) { el = null; }
        if (el) absEls.push({ fieldId: fieldId, el: el });
      });

      for (var i = 0; i < absEls.length; i++) {
        for (var j = i + 1; j < absEls.length; j++) {
          var rectA = safeRect(absEls[i].el);
          var rectB = safeRect(absEls[j].el);
          if (!rectA || !rectB) continue;
          if (rectsOverlap(rectA, rectB)) {
            results.push({
              code: 'EDITOR_OVERLAP',
              severity: 'warning',
              message: 'Elementen "' + absEls[i].fieldId + '" en "' + absEls[j].fieldId + '" overlappen elkaar op pagina ' + pageNum + '.',
              page: pageNum
            });
          }
        }
      }
    });
    return results;
  }

  function safeRect(el) {
    try {
      return el.getBoundingClientRect();
    } catch (e) {
      return null;
    }
  }

  function rectsOverlap(a, b) {
    return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  }

  /**
   * (b) Detecteert elementen waarvan de opgeslagen x/y/w/h ze buiten de
   * 210x297mm-pagina of buiten de veilige 10mm-marge plaatst.
   */
  function checkOutOfBounds() {
    var results = [];
    Object.keys(state.overrides).forEach(function (fieldId) {
      var ov = state.overrides[fieldId];
      if (!ov || ov.visible === false) return;
      var s = ov.style;
      if (s.x == null && s.y == null && s.w == null && s.h == null) return;

      var x = numOr(s.x, 0);
      var y = numOr(s.y, 0);
      var w = numOr(s.w, 0);
      var h = numOr(s.h, 0);

      var outsidePage = (x < 0 || y < 0 || (x + w) > PAGE_WIDTH_MM || (y + h) > PAGE_HEIGHT_MM);
      var outsideMargin = !outsidePage && (
        x < SAFE_MARGIN_MM || y < SAFE_MARGIN_MM ||
        (x + w) > (PAGE_WIDTH_MM - SAFE_MARGIN_MM) ||
        (y + h) > (PAGE_HEIGHT_MM - SAFE_MARGIN_MM)
      );

      if (outsidePage) {
        results.push({
          code: 'EDITOR_OUT_OF_BOUNDS',
          severity: 'error',
          message: 'Element "' + fieldId + '" valt buiten de paginagrenzen (210x297mm).',
          page: ov.page
        });
      } else if (outsideMargin) {
        results.push({
          code: 'EDITOR_OUT_OF_BOUNDS',
          severity: 'warning',
          message: 'Element "' + fieldId + '" overschrijdt de veilige marge van ' + SAFE_MARGIN_MM + 'mm.',
          page: ov.page
        });
      }
    });
    return results;
  }

  function numOr(val, fallback) {
    var n = parseFloat(val);
    return isNaN(n) ? fallback : n;
  }

  // --------------------------------------------------------------------
  // ReportValidation
  // --------------------------------------------------------------------

  var validation = {
    /** Combineert data-niveau checks met de overflow/editor-checks. */
    runAll: function () {
      var results = [];

      try {
        if (typeof runQualityChecks === 'function' && typeof currentData !== 'undefined') {
          var dataResults = runQualityChecks(currentData) || [];
          dataResults.forEach(function (r) {
            results.push(normalizeCheckResult(r));
          });
        }
      } catch (e) {
        console.warn('[MBEditor] runQualityChecks(currentData) gaf een fout', e);
      }

      results = results.concat(overflowChecker.check());
      return results;
    }
  };

  // --------------------------------------------------------------------
  // Export
  // --------------------------------------------------------------------

  window.MBEditor = {
    state: state,
    createDefaultOverride: createDefaultOverride,
    getOverride: getOverride,
    applyOverridesToDom: applyOverridesToDom,
    captureBaseline: captureBaseline,
    pushHistory: pushHistory,
    undo: undo,
    redo: redo,
    canUndo: canUndo,
    canRedo: canRedo,
    serializer: serializer,
    overflowChecker: overflowChecker,
    validation: validation,
    hashString: hashString,
    // interne hulpfuncties toch beschikbaar maken voor de UI-laag / debugging
    _internal: {
      findPageNumber: findPageNumber,
      guessElementType: guessElementType,
      deepClone: deepClone,
      getStage: getStage,
      PAGE_WIDTH_MM: PAGE_WIDTH_MM,
      PAGE_HEIGHT_MM: PAGE_HEIGHT_MM,
      SAFE_MARGIN_MM: SAFE_MARGIN_MM
    }
  };
})();
