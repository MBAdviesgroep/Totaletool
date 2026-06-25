import OpenAI from 'openai';

const ESG_SDG_FINANCE_EXTENSION = `

═══════════════════════════════════════════════════════════════
GEÏNTEGREERDE ESG/SDG/BANKLAAG — VERPLICHT
═══════════════════════════════════════════════════════════════
Je maakt niet alleen een technisch verduurzamingsrapport. Je vertaalt het dossier ook naar een professioneel bankwaardig adviesrapport voor MB Adviesgroep / Credion.

Gebruik daarom het beste van twee werelden:
1. DUURZAAMHEIDSTOOL = leidend voor input, documentanalyse, maatregelen, investering, besparing, subsidies, fasering, maandlasten en concrete uitvoering.
2. ESG/SDG-TOOL = leidend voor schrijfstijl, bankperspectief, financierbaarheid, risico's, bewijsstukken, SDG-koppeling en rapportagekwaliteit.

BELANGRIJKE REGELS:
- Neem ALLE maatregelen op uit de aangeleverde documenten, niet alleen de eerste.
- Gebruik exacte bedragen/cijfers uit de bron als die aanwezig zijn.
- Geen generieke teksten: koppel financiering, risico's en SDG's aan dit specifieke pand en deze specifieke maatregelen.
- Geen onjuiste aannames: noem geen monument, vergunning of Natura 2000 tenzij expliciet uit de documenten blijkt.
- Financieringsstuk moet adviesmatig zijn: niet alleen maandlast, maar investeringsbehoefte, financieringsroutes, bewijsstukken, voorwaarden en commerciële MB/Credion-haak.
- ESG/SDG mag het technische rapport versterken, maar mag de duurzaamheidsberekeningen niet overschrijven.

VOEG AAN DE JSON EXTRA VELDEN TOE NAAST HET BESTAANDE SCHEMA:
{
  "esg_banklaag": {
    "score": 0,
    "oordeel": "Sterk / Goed / Voorwaardelijk / Onvoldoende financierbaar",
    "samenvatting": "3-4 zinnen vanuit bank- en financieringsperspectief",
    "financierbaarheid": "duidelijke beoordeling van financierbaarheid op basis van labelverbetering, besparing, capex, TVT en bewijsniveau",
    "belangrijkste_bewijsstukken": ["offertes per maatregel", "energielabel vóór/na", "facturen", "opleverrapport", "meterdata"],
    "bankvoorwaarden": ["specifieke voorwaarde 1", "specifieke voorwaarde 2", "specifieke voorwaarde 3"],
    "risicos": [
      {"risico":"specifiek risico", "impact":"Laag/Middel/Hoog", "maatregel":"concrete beheersmaatregel"}
    ],
    "financieringsroutes": [
      {"route":"route naam", "toelichting":"wanneer logisch", "aandachtspunt":"waarop letten"}
    ]
  },
  "sdg_koppeling": [
    {"sdg":"7", "naam":"Betaalbare en duurzame energie", "uitleg":"concrete uitleg met cijfers/maatregelen uit dit dossier"},
    {"sdg":"11", "naam":"Duurzame steden en gemeenschappen", "uitleg":"concrete uitleg"},
    {"sdg":"12", "naam":"Verantwoorde consumptie en productie", "uitleg":"concrete uitleg"},
    {"sdg":"13", "naam":"Klimaatactie", "uitleg":"concrete uitleg met CO2-reductie"}
  ],
  "mb_credion_haak": "commerciële advieszin: waarom MB Adviesgroep/Credion hier waarde toevoegt"
}

Als het bestaande JSON-schema al velden zoals samenvatting, aandachtspunten, fases of subsidies bevat, vul die óók volledig en netjes. De extra velden zijn aanvullend.

Retourneer uitsluitend valide JSON, zonder markdown of tekst buiten JSON.
`;

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
