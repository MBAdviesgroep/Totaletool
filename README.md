# MB Duurzaamheids- & ESG-dossier (v10)

Eén professioneel, bankwaardig A4-dossier dat het beste van de duurzaamheidstool combineert met het beste van de ESG/SDG-tool. Het rapport rendert per pagina als een vaste A4 (web én print) en is opgebouwd uit het ESG-tool-stramien (vaste header/footer, paginastempel, print-vriendelijke inline-SVG-grafieken, conservatieve ESG-score).

## Wat is er nieuw in v10
- **Volledig herbouwd op de ESG/SDG-tool** (de output die de voorkeur had): elke pagina is één `<article class="a4 content">` die netjes op de analyse zelf afgekapt wordt — geen overlopende of lege pagina's.
- **Drie duurzaamheidspagina's vooraan toegevoegd** in dezelfde stijl: Energieprestatie (energielabelbalk + kerncijfers) en Geadviseerde maatregelen (tabel + toelichting per maatregel).
- **Groene paragraaf als volledige A4** (pagina 4) met grote kop, MB-logo, managementsamenvatting, financieringshaak, SFDR Art. 8 / Pillar 3 / EU Taxonomie 7.2, SDG-impact, risico's & voorwaarden, benodigde bewijsstukken en een opvallend donkerblauw conclusieblok.
- **Vercel Blob-upload** behouden: bron-PDF + optionele brochures + pandsfoto. GPT-4.1 leest de PDF native via de file-URL.
- **Conservatieve, consistente ESG-score**: de score wordt herberekend als gewogen gemiddelde van de 5 radar-dimensies (richtwaarde ±77, bewijsniveau 3/4). Cijfers blijven door het hele dossier consistent met het bronrapport.

## Paginavolgorde (11)
1. Cover — "Duurzaamheids- & ESG-dossier"
2. Energieprestatie (energielabelbalk, kerncijfers, kosten, besparing, CO₂, TVT, uitgangspunten)
3. Geadviseerde maatregelen (tabel + compacte toelichting per maatregel)
4. Groene paragraaf & financieringsadvies (volledige A4)
5. ESG-beoordeling in één oogopslag (score, radar, labeltraject)
6. Leeswijzer — scores & indicatoren
7. Risicomatrix & financieringsvoorwaarden (risico's, CO₂-emissiepad, scope 1/2 vóór/na, monitoring)
8. SDG per maatregel
9. SFDR / Pillar 3 / EU Taxonomie 7.2 / DNSH
10. Financiële analyse & terugverdientijd (break-even, maatregelenoverzicht, cumulatieve cashflow)
11. Conclusie & vervolgstappen (assurance-pad 1–4)

## Vereiste Vercel environment variables
- `OPENAI_API_KEY`
- `BLOB_READ_WRITE_TOKEN` **of** `BLOB2_READ_WRITE_TOKEN` (beide worden ondersteund in `api/upload.js`)

## Bestanden
- `index.html` — frontend + volledige rapport-rendering
- `api/upload.js` — Vercel Blob client-token (browser → Blob, omzeilt 4.5MB serverless-limiet)
- `api/generate-report.js` — GPT-4.1-aanroep met het volledige JSON-schema en conservatieve scoring

Na uploaden naar GitHub altijd opnieuw redeployen in Vercel.
