# MB Duurzaamheids- & ESG-dossier v7

Deze versie combineert de eerste sterke pagina's uit de duurzaamheidstool met de volledige ESG/SDG-opbouw uit de ESG-tool.

## Belangrijkste wijzigingen v7

- Rechter knop / nieuw-rapport knop verwijderd uit de resultaatweergave.
- Rechter zwevende UI / AI-panel / inhoudsopgave uitgezet om foutieve knoppen en rommel te voorkomen.
- Titel en PDF-bestandsnaam aangepast naar `Duurzaamheids- en ESG-dossier`.
- Groene paragraaf opnieuw strak opgemaakt als volledige A4-pagina met duidelijke afsluitende conclusie.
- ESG/SDG-pagina's visueel opgeschoond: betere kaartverdeling, compactere tabellen en minder lege ruimte.
- Oude losse duurzaamheidspagina's voor subsidies, maandlasten, fasering en vervolg worden niet meer getoond, om lege pagina's te voorkomen.
- Kleine bugs gecorrigeerd: dubbele besparingsbadge bij maatregelen, dubbele KPI-subtekst, lege secties worden automatisch opgeruimd.
- Upload ondersteunt zowel `BLOB_READ_WRITE_TOKEN` als `BLOB2_READ_WRITE_TOKEN`.

## Vereiste Vercel environment variables

- `OPENAI_API_KEY`
- `BLOB_READ_WRITE_TOKEN` of `BLOB2_READ_WRITE_TOKEN`

Na uploaden naar GitHub altijd opnieuw redeployen in Vercel.

## v8 aanpassing
- Rechter sticky inhoudsopgave / navigatie volledig verwijderd uit HTML, JavaScript en CSS fallback.
- Residuele `renderTocRail()`-functie geneutraliseerd zodat oude UI niet meer kan verschijnen.
