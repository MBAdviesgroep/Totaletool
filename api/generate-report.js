import OpenAI from 'openai';

const ESG_SDG_FINANCE_EXTENSION = `

═══════════════════════════════════════════════════════════════
GEÏNTEGREERD RAPPORT — BESTE VAN DUURZAAMHEID + BESTE VAN ESG/SDG
═══════════════════════════════════════════════════════════════
Maak ÉÉN compact MB Adviesgroep-rapport. Geen twee rapporten achter elkaar.

GEWENSTE RAPPORTVOLGORDE:
1. Energieprestatie & energielabel — kort, visueel en begrijpelijk.
   Gebruik de sterke kern uit het verduurzamingsrapport: object, adres, bouwjaar, BVO/VVO/VVO, huidig label, streeflabel, huidige energiekosten, jaarlijkse besparing, CO₂-reductie en terugverdientijd.
2. Geadviseerde maatregelen — exact en concreet.
   Neem ALLE maatregelen op uit de bron. Per maatregel: naam, investering, besparing per jaar, CO₂-impact, TVT en compacte toelichting.
3. Groene paragraaf — de echte bankwaardige duurzaamheidsduiding.
   Dit is GEEN volledig apart ESG-dossier, maar één sterke pagina/paragraaf na de maatregelen. Hierin staat waarom het pakket groen-financierbaar kan zijn en welke ESG/SDG/Taxonomie/SFDR-haak er is.
4. Financiële uitwerking — subsidies/fiscale regelingen, netto investering en maandlasten.
5. Fasering, aandachtspunten en vervolgstappen.

WAT KOMT IN DE GROENE PARAGRAAF?
- Conclusie in gewone taal: is dit dossier indicatief geschikt voor groene financiering?
- ESG-score/oordeel op basis van labelverbetering, CO₂-reductie, TVT, capex, datakwaliteit en bewijsniveau.
- SDG-koppeling: vooral SDG 7, 11, 12 en 13; SDG 9 alleen bij techniek zoals warmtepomp/zonnepanelen; SDG 3 alleen bij comfort/binnenklimaat.
- SFDR Artikel 8: alleen voorzichtig formuleren als “kan onder voorwaarden bijdragen aan”.
- EU Taxonomie 7.2: alleen “potentieel/indicatief passend” tenzij DNSH, sociale waarborgen en nieuw label zijn bewezen.
- Pillar 3/bankrapportage: waarom label, energie-intensiteit en CO₂-reductie bruikbaar zijn voor bankrapportage.
- Risico’s en voorwaarden: specifiek voor het pand en maatregelen, geen generieke risico’s.
- MB/Credion-haak: hoe MB Adviesgroep/Credion kan helpen met financiering, bewijsstukken, offertes en subsidie/fiscale toets.

BELANGRIJKE REGELS:
- Duurzaamheidstool is leidend voor technische cijfers, maatregelen, investering, besparing, subsidies, fasering en maandlasten.
- ESG/SDG-tool is leidend voor schrijfkwaliteit, bankperspectief, financierbaarheid, risico’s, bewijsstukken en groene paragraaf.
- Gebruik exacte bedragen/cijfers uit de bron als die aanwezig zijn.
- Geen generieke teksten: koppel alles aan dit specifieke pand en deze specifieke maatregelen.
- Geen onjuiste aannames: noem geen monument, vergunning, Natura 2000, asbestvrij of OECD/ILO-bevestigd tenzij expliciet uit de documenten blijkt.
- Fiscale regelingen (EIA/MIA/KIA) zijn fiscale voordelen via aangifte; noem ze niet als directe subsidie/factuurkorting.
- Financieringsstuk moet adviesmatig zijn: investeringsbehoefte, financieringsroutes, bewijsstukken, voorwaarden en commerciële MB/Credion-haak.

VOEG AAN DE JSON EXTRA VELDEN TOE NAAST HET BESTAANDE SCHEMA:
{
  "groene_paragraaf": {
    "titel": "Groene paragraaf — financierbaarheid & duurzaamheidsimpact",
    "conclusie": "4-6 zinnen in gewone taal over waarom dit object onder voorwaarden groen financierbaar kan zijn, met concrete cijfers.",
    "esg_score": 0,
    "oordeel": "Sterk / Goed / Voorwaardelijk / Aanvullende onderbouwing nodig",
    "sfdr": "2-3 zinnen: voorzichtig, onder voorwaarden, met concrete cijfers.",
    "taxonomie": "2-3 zinnen: EU Taxonomie 7.2 potentieel/indicatief, met voorwaarden DNSH, sociale waarborgen en nieuw label.",
    "pillar3": "2-3 zinnen: bruikbaarheid voor bankrapportage, labeltraject, CO2 en energie-intensiteit.",
    "sdg_koppelingen": [
      {"sdg":"7", "naam":"Betaalbare en duurzame energie", "uitleg":"concrete uitleg met cijfers/maatregelen"},
      {"sdg":"11", "naam":"Duurzame steden en gemeenschappen", "uitleg":"concrete uitleg"},
      {"sdg":"12", "naam":"Verantwoorde consumptie en productie", "uitleg":"concrete uitleg"},
      {"sdg":"13", "naam":"Klimaatactie", "uitleg":"concrete uitleg met CO2-reductie"}
    ],
    "risicos_en_voorwaarden": [
      {"punt":"specifiek risico of voorwaarde", "actie":"concrete beheersmaatregel of bewijsstuk"}
    ],
    "benodigde_bewijsstukken": ["offertes per maatregel", "energielabel vóór/na", "facturen", "opleverrapport", "meterdata"],
    "mb_credion_haak": "1-2 commerciële advieszinnen waarom MB Adviesgroep/Credion hier waarde toevoegt."
  }
}

Als het bestaande schema al velden zoals samenvatting, aandachtspunten, fases of subsidies bevat, vul die óók volledig en netjes. De groene_paragraaf is aanvullend en moet na de maatregelen renderbaar zijn.

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
