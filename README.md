# MB Duurzaamheids- & ESG-dossier (v12)

## Nieuw in v12 — kwaliteitsronde 3
- **Logo vervangen** door de schone transparante PNG; alle logo-plekken staan nu op een witte achtergrond met `object-fit:contain` (geen zwarte rand meer).
- **Besparing > energiekosten wordt nooit als harde KPI getoond.** Bij `besparing > energiekosten` krijgt de besparings-KPI (pagina 2 én groene paragraaf) een amber "nader te valideren"-status met toelichting, en de terugverdientijd wordt als indicatief gemarkeerd. De huidige energiekosten worden **uit het bronrapport overgenomen en niet opgehoogd**.
- **Primaire-energiereductie losgekoppeld van CO₂** (mag er niet automatisch aan gelijk zijn); indicatief afgeleid uit de labelstappen.
- **CO₂-totaalregel** toont de gevalideerde scope 1+2-reductie; de (hogere) rekenkundige optelsom per maatregel wordt bewust niet meer als officieel totaal gepresenteerd.
- **Compacter: 10 sterke pagina's i.p.v. 12.** De dubbele financiële pagina en de losse leeswijzer zijn verwijderd; de leeswijzer-kern staat nu compact op de ESG-pagina. Paginanummers zijn dynamisch (`NN · TOT`).
- **Groene paragraaf** in de juiste volgorde: hero → titel → subtitel → samenvatting → KPI's → financieringshaak → bewijsstukken → risico's → sterke slotconclusie.
- Extra **claim-softening**: "voldoet aan", "aantoonbaar", "garandeert", "definitief aligned" worden automatisch afgezwakt.

---

# MB Duurzaamheids- & ESG-dossier (v11)

Eén professioneel, bankwaardig A4-dossier dat het beste van de duurzaamheidstool combineert met het beste van de ESG/SDG-tool. Het rapport rendert per pagina als een vaste A4 (web én print) met vaste header/footer, paginastempel, print-vriendelijke inline-SVG-grafieken en een conservatieve ESG-score.

## Wat is er nieuw in v11 — kwaliteitsronde

### Eén bron van waarheid voor alle cijfers
- **`reconcileNumbers()`** — centrale normalisatielaag. De maatregelentabel is leidend: `capex_totaal` en `bes_jaar` zijn de som van de maatregelen; terugverdientijd (`capex ÷ besparing`) en break-even (`afronding naar boven`) worden hier afgeleid en zijn door het hele dossier identiek.
- **Validatieregels** vangen onlogische combinaties af:
  - Jaarlijkse besparing kan **nooit** ≥ de huidige energiekosten zijn (kosten worden anders indicatief afgeleid).
  - Eén basis voor terugverdientijd én break-even (bruto investering) — geen "jaar 4 vs. 6,3 jaar" meer.
  - CO₂: de gevalideerde **scope 1+2-reductie is leidend**; de (hogere) som van de CO₂-posten per maatregel wordt apart getoond met een voetnoot die het verschil uitlegt.
  - Primaire-energiereductie wordt afgeleid uit de labelstappen — **nooit meer "n.b.%"**.
  - Oppervlakte krijgt altijd "m²".
- **`sanitizeNarratives()`** — bouwt álle cijferdragende lopende tekst (uitgangspunten, managementsamenvatting, groene paragraaf, SFDR/PAI/Pillar 3/EU Taxonomie, subsidies) opnieuw op uit de canonieke waarden. Tegenstrijdige bedragen die de AI in vrije tekst zette (€ 19.000, € 2.396, 13,6 jaar, "n.b.%") kunnen nooit meer in het eindrapport verschijnen. Globale scrub verwijdert "n.b.%", "NaN" en dubbele nummering in de vervolgstappen.

### Inhoudelijk gecorrigeerd
- Subsidies opnieuw opgebouwd uit de maatregelen: **ISDE alleen op warmtepomp + isolatie (uitdrukkelijk niet op zonnepanelen)**, btw-zonnepanelen voorzichtig geformuleerd (0%-tarief, te bevestigen), gemeentelijke regeling als "lokaal te bevestigen".
- Conservatief, voorwaardelijk geformuleerd financieringsoordeel ("indicatief geschikt onder voorwaarden").

### Visueel
- **Premium subsidiepagina**: luxe kaarten met status-badge (kansrijk / te bevestigen / lokaal te bevestigen), gekoppelde maatregelen, voorwaarden én benodigde bewijsstukken, plus een conclusieblok met actiepunt en voorbehoud.
- Groene paragraaf met correcte titel en bankwaardige, canonieke samenvatting.

## Demo / preview zonder backend
Open `index.html?demo=1` om een voorbeelddossier (Beatrixlaan 138) te renderen dat door exact dezelfde normalisatie- en sanitatielaag loopt als de live-flow. Alleen voor visuele controle.

## Paginavolgorde (10)
1. Cover  2. Energieprestatie & kerncijfers  3. Geadviseerde maatregelen
4. Subsidies & regelingen  5. Groene paragraaf & financieringsadvies
6. ESG-beoordeling + compacte leeswijzer  7. SDG-impact per maatregel
8. SFDR / Pillar 3 / EU Taxonomie 7.2 / DNSH  9. Risicomatrix & financieringsvoorwaarden
10. Conclusie & vervolgstappen

## Vereiste Vercel environment variables
- `OPENAI_API_KEY`
- `BLOB_READ_WRITE_TOKEN` **of** `BLOB2_READ_WRITE_TOKEN` (beide worden ondersteund in `api/upload.js`)

## Bestanden
- `index.html` — frontend + volledige rapport-rendering + normalisatie/sanitatielaag
- `api/upload.js` — Vercel Blob client-token (browser → Blob, omzeilt de 4.5MB serverless-limiet)
- `api/generate-report.js` — GPT-4.1-aanroep; de frontend is de single source of truth voor cijfers en formattering

Na uploaden naar GitHub altijd opnieuw redeployen in Vercel.
