import OpenAI from 'openai';

const ESG_SDG_FINANCE_EXTENSION = `

═══════════════════════════════════════════════════════════════
V4 RAPPORTOPBOUW — DUURZAAMHEIDSKERN + A4 GROENE PARAGRAAF + SDG PER MAATREGEL
═══════════════════════════════════════════════════════════════
Maak ÉÉN compact MB Adviesgroep-rapport. Gebruik NIET de volledige ESG/SDG-tool als losse output met 8 pagina's.

GEWENSTE OPBOUW IN DE FRONTEND:
1. Voorblad.
2. Energieprestatie uit de duurzaamheidstool: energielabelbalk, huidig label, streeflabel, energiekosten, besparing, CO₂-reductie, terugverdientijd, uitgangspunten.
3. Geadviseerde maatregelen uit de duurzaamheidstool: alle maatregelen met investering, besparing, CO₂ en TVT, plus compacte toelichting.
4. Daarna één volledige A4-pagina: "Groene paragraaf & ESG-financieringsadvies" in de stijl van het ESG/SDG-dossier, met duidelijke afsluitende conclusie onderaan.
5. Daarna een SDG-pagina per maatregel/maatregelenoverzicht: per maatregel de meest relevante SDG-koppelingen, zoals in de ESG/SDG-tool.

BELANGRIJK: genereer GEEN losse score-radar, risicomatrix, cashflowgrafiek of vervolgpagina. De frontend toont WEL een groene A4-paragraaf en WEL een SDG-pagina per maatregel. De opbouw en toon moeten lijken op het ESG/SDG-rapport, maar compact en netjes per A4 afgesloten.

VERWIJDERDE/NIET-BEDOELDE ONDERDELEN:
- Geen cumulatieve besparingsgrafiek.
- Geen scenariovergelijker.
- Geen losse financierings-/maandlastenpagina.
- Geen aparte subsidies/fiscale regelingenpagina.
- Wel een SDG-pagina per maatregel, met maatregel-specifieke SDG-koppelingen.
- Geen apart volledig ESG-dossier van 8 pagina's.
- Geen grafiekpagina na de groene paragraaf.

WAT MOET WEL IN DE GROENE_PARAGRAAF JSON?
Schrijf de groene_paragraaf in de stijl van het ESG/SDG-dossier: bankwaardig, strak, concreet, met SFDR, Pillar 3, EU Taxonomie 7.2, SDG-impact, risico’s, voorwaarden, bewijsstukken en MB/Credion-haak.
Gebruik concrete cijfers uit het verduurzamingsrapport: labeltraject, investering, besparing, CO₂-reductie, energieverbruik, gas/stroom waar beschikbaar.

Vul deze velden zorgvuldig:
{
  "groene_paragraaf": {
    "titel": "Groene paragraaf — ESG-financieringsadvies",
    "conclusie": "6-8 zinnen in gewone taal, bankwaardig. Leg uit waarom dit object onder voorwaarden groen financierbaar kan zijn, met exacte cijfers uit het rapport.",
    "esg_score": 0,
    "oordeel": "Sterk financierbaar ESG-dossier / Goed financierbaar met bewijsstukken / Voorwaardelijk financierbaar / Aanvullende onderbouwing nodig",
    "sfdr": "2-3 zinnen in ESG-dossier-stijl: kan onder voorwaarden bijdragen aan SFDR Artikel 8. Concrete cijfers noemen.",
    "taxonomie": "2-3 zinnen: EU Taxonomie 7.2 potentieel/indicatief passend, met voorwaarden DNSH, sociale waarborgen, nieuw label en oplevering.",
    "pillar3": "2-3 zinnen: bruikbaarheid voor bankrapportage: labeltraject, CO₂, energie-intensiteit, investering en besparing.",
    "sdg_koppelingen": [
      {"sdg":"7", "naam":"Betaalbare en duurzame energie", "uitleg":"Concrete uitleg met maatregelen en cijfers."},
      {"sdg":"11", "naam":"Duurzame steden en gemeenschappen", "uitleg":"Concrete uitleg met vastgoedwaarde, comfort en toekomstbestendigheid."},
      {"sdg":"12", "naam":"Verantwoorde consumptie en productie", "uitleg":"Concrete uitleg over efficiënt energie- en materiaalgebruik."},
      {"sdg":"13", "naam":"Klimaatactie", "uitleg":"Concrete uitleg met CO₂-reductie."}
    ],
    "risicos_en_voorwaarden": [
      {"punt":"Specifiek risico of voorwaarde uit dit dossier", "actie":"Concrete beheersmaatregel of bewijsstuk"}
    ],
    "benodigde_bewijsstukken": ["offertes per maatregel", "energielabel vóór/na", "facturen", "opleverrapport", "meterdata"],
    "mb_credion_haak": "1-2 sterke commerciële advieszinnen waarom MB Adviesgroep/Credion waarde toevoegt bij financiering en bewijsvoering.",
    "afsluitende_conclusie": "Korte slotconclusie voor onderaan de groene A4-pagina: indicatief wel/niet groen financierbaar en welke bewijsstukken nog nodig zijn."
  }
}

MAATREGELEN EN SDG-KOPPELINGEN:
Geef waar mogelijk per maatregel ook een veld "sdg_koppelingen" terug met 2-5 relevante SDGs. Gebruik geen generieke kopieertekst: de uitleg moet passen bij het type maatregel.
- Isolatie/glas/kierdichting: SDG 3, 7, 11, 12, 13.
- Warmtepomp/installatie: SDG 7, 9, 13 en eventueel 3.
- Zonnepanelen/opwek: SDG 7, 9, 13 en eventueel 11.
- Slimme thermostaat/monitoring: SDG 7, 9, 12.
Gebruik bij voorkeur concrete besparing en CO2-cijfers per maatregel.

REGELS:
- De duurzaamheidstool blijft leidend voor technische cijfers, energielabel en maatregelen.
- De ESG/SDG-tool is leidend voor schrijfkwaliteit en bankduiding in de groene paragraaf.
- Noem geen monument, Natura 2000, asbestvrij of OECD/ILO tenzij expliciet in bron vermeld.
- Formuleer voorzichtig: "indicatief", "onder voorwaarden", "na uitvoering te bevestigen".
- Gebruik uitsluitend valide JSON terug, zonder markdown.
`

function buildPrompt({ system_prompt, notities, brochureCount }) {
  const base = system_prompt || 'Maak een professioneel MB Adviesgroep verduurzamingsrapport in JSON.';
  return base + ESG_SDG_FINANCE_EXTENSION +
    `\n\nAANTAL DOCUMENTEN: 1 energiescan/bankrapport + ${brochureCount} brochure/gebouwinfo-bestand(en). Lees ze ALLEMAAL.` +
    (notities ? '\n\nExtra toelichting van gebruiker:\n' + notities : '');
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

    // Frontend parseAgentResponse verwacht meestal { success:true, data:'JSON-string' }.
    return res.status(200).json({ success: true, data: outputText });
  } catch (error) {
    console.error('Generate-report error:', error);
    return res.status(500).json({ error: error.message || 'AI verwerking mislukt' });
  }
}
