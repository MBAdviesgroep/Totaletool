# MB Verduurzaming + ESG Tool v3

Deze versie gebruikt niet langer een volledig apart ESG-dossier achter het verduurzamingsrapport. De opbouw is nu bewust compact:

1. Voorblad
2. Energieprestatie + energielabelbalk + kerncijfers uit de duurzaamheidstool
3. Geadviseerde maatregelen + toelichting per maatregel uit de duurzaamheidstool
4. Eén gevulde groene paragraaf / ESG-financieringsadvies in de stijl van het ESG/SDG-dossier

Bewust verwijderd uit de frontend-output:

- losse cumulatieve besparingsgrafiek
- scenariovergelijker
- subsidies/fiscale regelingen-pagina
- netto-investering en maandlasten-pagina
- aparte ESG-score/radar-pagina's
- volledig los ESG-dossier van 8 pagina's

## Bestanden

- `index.html`: frontend met compacte rapportopbouw en nieuwe groene paragraaf.
- `api/upload.js`: Vercel Blob uploadroute met fallback voor `BLOB2_READ_WRITE_TOKEN`.
- `api/generate-report.js`: AI-route met aangepaste prompt voor de nieuwe rapportstructuur.
- `package.json`: dependencies voor OpenAI en Vercel Blob.

## Benodigde environment variables op Vercel

- `OPENAI_API_KEY`
- `BLOB_READ_WRITE_TOKEN` of `BLOB2_READ_WRITE_TOKEN`

## Deploy

Upload deze map naar GitHub en deploy via Vercel. Na wijzigen van environment variables altijd opnieuw redeployen.
