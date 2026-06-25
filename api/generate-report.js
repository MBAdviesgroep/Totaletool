import OpenAI from 'openai';

/* ════════════════════════════════════════════════════════════════════
   MB Duurzaamheids- & ESG-dossier — AI-instructie
   De frontend rendert een vast A4-stramien (11 pagina's). De AI vult
   uitsluitend de inhoud. Het verduurzamingsrapport is LEIDEND voor alle
   cijfers; de ESG-tekst is leidend voor de bankduiding.
   ════════════════════════════════════════════════════════════════════ */
const SYSTEM_BASE = `Je bent een senior ESG- en verduurzamingsanalist bij MB Adviesgroep. Je stelt op basis van een aangeleverd verduurzamings-/energierapport (PDF) één professioneel, bankwaardig "Duurzaamheids- & ESG-dossier" op. Je antwoordt UITSLUITEND met geldige JSON (geen markdown, geen uitleg eromheen).`;

const SCHEMA_EXTENSION = `

═══════════════════════════════════════════════════════════════
RAPPORTOPBOUW (de frontend toont deze 11 A4-pagina's)
═══════════════════════════════════════════════════════════════
1. Cover  2. Energieprestatie  3. Geadviseerde maatregelen
4. Groene paragraaf & financieringsadvies (volledige A4)
5. ESG-beoordeling in één oogopslag  6. Leeswijzer scores
7. Risicomatrix & financieringsvoorwaarden  8. SDG per maatregel
9. SFDR / Pillar 3 / EU Taxonomie 7.2  10. Financiële analyse / terugverdientijd
11. Conclusie & vervolgstappen

KERNREGELS
- Het verduurzamingsrapport is LEIDEND voor alle cijfers: energielabel-traject, energiekosten, investering (capex), jaarlijkse besparing, terugverdientijd, break-even, CO₂-reductie en de maatregelen. Neem deze EXACT over uit de maatregelentabel. LET OP: de frontend bevat een normalisatie- en validatielaag die alle kerncijfers vastzet en alle cijferdragende lopende tekst (uitgangspunten, samenvatting, groene paragraaf, SFDR/PAI/Pillar 3/Taxonomie, subsidies) opnieuw opbouwt uit die canonieke waarden. Zet daarom de maatregelen, scope_voor/na en het verbruik zo nauwkeurig mogelijk; de exacte formattering verzorgt de frontend.
- Geef voor energiekosten, gas- en stroomverbruik de waarden uit het bronrapport; laat ze leeg als ze niet betrouwbaar zijn (de frontend leidt dan een indicatieve waarde af). Een jaarlijkse besparing is NOOIT hoger dan de huidige energiekosten.
- Verzin GEEN nieuwe maatregelen als het rapport al maatregelen bevat. Reken alleen af als een waarde ontbreekt; markeer afgeleide waarden met de bijbehorende *_afgeleid:true vlag.
- CONSISTENTIE (hard): gebruik EXACT ÉÉN waarde voor de jaarlijkse besparing in het hele dossier. De jaarlijkse besparing is NOOIT hoger dan de huidige energiekosten (energiekosten_huidig ≥ bes_jaar). De terugverdientijd = capex_totaal ÷ bes_jaar en capex_totaal = som van de maatregel-capex. Laat geen enkel bedrag (besparing, kosten, investering, CO₂, TVT) tussen pagina's of in de groene paragraaf afwijken.
- Investeringsbedragen per maatregel moeten realistisch zijn (marktconform, incl. btw bij particulier / excl. btw bij zakelijk) — geen onrealistisch lage schijnbedragen.
- Formuleer groene financiering altijd voorzichtig: "indicatief", "onder voorwaarden", "na uitvoering te bevestigen".
- Noem geen monument, Natura 2000, asbestvrij, OECD/ILO etc. als feit tenzij dit expliciet in de bron staat; formuleer anders als "te bevestigen".

ESG-SCORE — REALISTISCH EN CONSERVATIEF
- De score (0–100) wordt door de frontend herberekend als gewogen gemiddelde van de 5 radar-dimensies (gewichten: Transitierisico .25, Datakwaliteit .20, Bewijsniveau .20, Klimaatrisico .15, Rapportage .20). Kies de radar-waarden daarom realistisch.
- Voor een typisch dossier met labeltraject richting A, bewijsniveau 3/4 en nog te leveren oplevering/bewijsstukken hoort een score van ±75–80 (bijv. 77). Geef NOOIT zomaar 85+.
- bankscore ≈ 77 als richtwaarde; bewijsniveau (assurance_niveau) = 3 zolang er een bronrapport is maar nog geen oplevering/nieuw label/meterdata.

LEVER PRECIES DIT JSON-OBJECT (vul alle velden; gebruik getallen zonder valutateken voor numerieke velden):
{
  "object_naam": "", "object_adres": "", "functie": "", "bouwjaar": "", "oppervlakte": "", "stroomverbruik": "", "gasverbruik": "", "datum_rapport": "",
  "huidig_label": "E", "streef_label": "A",
  "label_pad": ["G","F","E","D","C","B","A","A+","A++","A+++","A++++"],
  "label_huidig_idx": 2, "label_streef_idx": 6,
  "primaire_energie_reductie_pct": 0,

  "energiekosten_huidig": 0, "bes_jaar": 0, "tvt_jaar": 0, "tvt_afgeleid": false,
  "break_even_jaar": 0, "break_even_afgeleid": false,
  "capex_totaal": 0, "capex_subsidie": 0, "capex_eigen": 0, "capex_lening": 0,
  "co2_reductie_pct": 0, "co2_reductie_ton": 0, "co2_uitleg": "",
  "rentekorting_bps": 25, "looptijd_jr": 15,

  "uitgangspunten": ["4–6 korte uitgangspunten in gewone taal, met concrete cijfers uit de bron"],

  "subsidies": [ {"naam":"bijv. ISDE / EIA / Nationaal Warmtefonds / SVOH / gemeentelijke regeling", "voor":"voor welke maatregel(en) deze geldt", "bedrag":"indicatief bedrag of bandbreedte", "voorwaarden":"korte voorwaarden/aandachtspunten", "uitleg":"1 korte zin"} ],
  "subsidie_conclusie": "1–2 zinnen: welke regelingen het meest relevant zijn voor dit object/deze klant (stem af op particulier vs. zakelijk).",

  "maatregelen": [
    { "naam": "", "capex": 0, "bes": 0, "co2": 0, "tvt": 0,
      "toelichting": "1 compacte zin: wat doet de maatregel en wat levert het op (in euro's).",
      "sdg_koppelingen": [ {"sdg_nr":"7","uitleg":"maatregel-specifieke uitleg met cijfer"} ] }
  ],

  "bankscore": 77,
  "bankscore_oordeel": "Geschikt voor groene financiering onder voorwaarden",
  "samenvatting": "4–6 zinnen managementsamenvatting in gewone taal, met exacte cijfers uit de bron.",
  "samenvatting_punten": ["3–4 korte kernpunten"],
  "bankscore_componenten": [ {"l":"ESG-score (gewogen)","v":"77 / 100"}, {"l":"Bewijsniveau","v":"Niveau 3 / 4"}, {"l":"Datakwaliteit","v":"Bron-rapport gevalideerd"}, {"l":"Beleidsrisico energie","v":"Laag · dalend"}, {"l":"Klimaatrisico (fysiek)","v":"Laag-middel"}, {"l":"Rapportagegereedheid","v":"Voorwaardelijk"} ],

  "radar": [ {"l":"Transitierisico","v":78}, {"l":"Datakwaliteit","v":74}, {"l":"Bewijsniveau","v":75}, {"l":"Klimaatrisico","v":72}, {"l":"Rapportage","v":80} ],

  "scope_voor": {"s1":0,"s2":0,"tot":0},
  "scope_na":   {"s1":0,"s2":0,"tot":0},
  "co2_pad":   [/* 16 getallen: ton CO₂/jr van jaar 0 t/m 15, dalend van scope_voor.tot naar scope_na.tot */],
  "cashflow":  [/* 16 getallen: cumulatieve cashflow € van jaar 0 (negatief = -capex_eigen of -capex_totaal) t/m jaar 15, jaarlijks +bes_jaar */],

  "risicos": [ {"risk":"","ernst":"Laag|Middel|Hoog","horizon":"Kort|Middel|Lang","action":""} ],
  "voorwaarden": ["concrete financieringsvoorwaarden"],
  "monitoring": ["monitoring tijdens de looptijd"],

  "sfdr": "2–3 zinnen SFDR Artikel 8, met concrete cijfers, indicatief.",
  "pai": ["3 PAI-regels met cijfers"],
  "pillar3": "2–3 zinnen Pillar 3-bruikbaarheid.",
  "taxonomie": { "activiteit":"7.2 Renovatie van bestaande gebouwen", "eligibility":"Eligible", "alignment":"Potentieel aligned — DNSH en sociale waarborgen te bevestigen", "contribution":"2–3 zinnen met primaire-energiereductie en labelstappen.", "dnsh":[ {"l":"Klimaatadaptatie","v":""},{"l":"Water","v":""},{"l":"Circulaire economie","v":""},{"l":"Vervuiling","v":""},{"l":"Natuur & biodiversiteit","v":""},{"l":"Sociale waarborgen","v":""} ] },

  "evidence": [ {"ond":"","w":"","bron":"","z":"Hoog|Middel|Laag","actie":""} ],
  "missing":  [ {"stuk":"","prio":"Hoog|Middel|Laag","actie":""} ],
  "assurance_niveau": 3,
  "assurance_tekst": "2–3 zinnen: indicatief bruikbaar onder voorwaarden.",
  "vervolg": ["3–4 genummerde vervolgstappen"],

  "groene_paragraaf": {
    "titel": "Groene paragraaf & financieringsadvies",
    "conclusie": "5–7 zinnen managementsamenvatting in gewone taal, bankwaardig, met exacte cijfers (labeltraject, investering, besparing, CO₂).",
    "esg_score": 77,
    "oordeel": "Sterk financierbaar ESG-dossier | Goed financierbaar met bewijsstukken | Voorwaardelijk financierbaar | Aanvullende onderbouwing nodig",
    "sfdr": "2–3 zinnen, ESG-dossier-stijl, met cijfers.",
    "taxonomie": "2–3 zinnen EU Taxonomie 7.2, indicatief, met voorwaarden (DNSH, sociale waarborgen, nieuw label, oplevering).",
    "pillar3": "2–3 zinnen bankrapportage-bruikbaarheid.",
    "sdg_koppelingen": [ {"sdg":"7","naam":"Betaalbare en duurzame energie","uitleg":"concreet met cijfers"}, {"sdg":"11","naam":"Duurzame steden en gemeenschappen","uitleg":""}, {"sdg":"12","naam":"Verantwoorde consumptie en productie","uitleg":""}, {"sdg":"13","naam":"Klimaatactie","uitleg":""} ],
    "risicos_en_voorwaarden": [ {"punt":"","actie":""} ],
    "benodigde_bewijsstukken": ["offertes per maatregel","energielabel vóór/na","facturen","opleverrapport","meterdata"],
    "mb_credion_haak": "1–2 sterke commerciële advieszinnen over de meerwaarde van MB Adviesgroep/Credion bij financiering en bewijsvoering.",
    "afsluitende_conclusie": "Korte slotconclusie: indicatief wel/niet groen financierbaar en welke bewijsstukken nog nodig zijn."
  }
}

MAATREGEL → SDG-KOPPELINGEN (gebruik passende, niet-generieke uitleg met cijfers):
- Isolatie / glas / kierdichting: SDG 3, 7, 11, 12, 13.
- Warmtepomp / installatie: SDG 7, 9, 13 (evt. 3).
- Zonnepanelen / opwek: SDG 7, 9, 13 (evt. 11).
- Slimme thermostaat / monitoring: SDG 7, 9, 12.

Lever uitsluitend valide JSON terug, zonder markdown.`;

function buildPrompt({ system_prompt, notities, brochureCount }) {
  const base = system_prompt || SYSTEM_BASE;
  return base + SCHEMA_EXTENSION +
    `\n\nAANTAL DOCUMENTEN: 1 verduurzamings-/energierapport + ${brochureCount} brochure/gebouwinfo-bestand(en). Lees ze ALLEMAAL.` +
    (notities ? '\n\nExtra toelichting/wensen van de adviseur (zwaar laten meewegen):\n' + notities : '');
}

function getOutputText(response) {
  if (response?.output_text) return response.output_text;
  const parts = [];
  for (const item of response?.output || []) {
    for (const c of item?.content || []) {
      if (c?.text) parts.push(c.text);
    }
  }
  return parts.join('\n').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    const {
      energiescan_url,
      brochure_urls,
      brochure_url,
      notities,
      system_prompt,
    } = req.body || {};

    if (!energiescan_url) {
      return res.status(400).json({ error: 'Energiescan URL ontbreekt.' });
    }

    const brochures = Array.isArray(brochure_urls)
      ? brochure_urls.filter(Boolean)
      : (brochure_url ? [brochure_url] : []);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = buildPrompt({ system_prompt, notities, brochureCount: brochures.length });

    const content = [
      { type: 'input_text', text: prompt },
      { type: 'input_file', file_url: energiescan_url },
      ...brochures.map((url) => ({ type: 'input_file', file_url: url })),
    ];

    let response;
    try {
      response = await client.responses.create({
        model: 'gpt-4.1',
        input: [{ role: 'user', content }],
      });
    } catch (firstErr) {
      if (firstErr?.status === 429 || String(firstErr?.message || '').includes('429')) {
        response = await client.responses.create({
          model: 'gpt-4.1-mini',
          input: [{ role: 'user', content }],
        });
      } else {
        throw firstErr;
      }
    }

    const outputText = getOutputText(response);
    if (!outputText) {
      return res.status(500).json({ error: 'AI gaf geen tekst terug.' });
    }

    // De frontend verwacht { success:true, data:'JSON-string' }.
    return res.status(200).json({ success: true, data: outputText });
  } catch (error) {
    console.error('Generate-report error:', error);
    return res.status(500).json({ error: error.message || 'AI verwerking mislukt' });
  }
}
