# MB Adviesgroep - Duurzaamheids- & ESG-dossier

Deze versie bevat extra aanvragerlogica en tekstuele kwaliteitscorrecties.

## Belangrijkste wijzigingen

- Startpagina bevat nu expliciete keuze voor **Type aanvrager**: Particulier, Ondernemer / zakelijk of VvE.
- De keuze wordt opgeslagen in de rapportdata (`__aanvrager_type`, `__aanvrager_label`, `applicantType`) en stuurt subsidies, bewijsstukken, financieringsroute en taalgebruik.
- Subsidiefilter aangescherpt:
  - Particulier: particuliere regelingen, Warmtefonds en 0%-btw zonnepanelen waar passend.
  - Ondernemer / zakelijk: zakelijke regelingen zoals EIA, MIA/Vamil, KIA, ISDE zakelijk, SDE++ en bancaire ESG-duiding.
  - VvE: SVVE, ALV-besluit, MJOP, mandaat bestuur en VvE-financiering.
- Nationaal Warmtefonds toegevoegd als **financiering / lening**, niet als subsidie.
- SVVE toegevoegd als VvE-specifieke regeling.
- Cover en rapporttitel aangescherpt naar **Duurzaamheids- & ESG-dossier**.
- Type aanvrager wordt zichtbaar op cover/header en in de groene financieringsparagraaf.
- Tekstcorrecties toegevoegd in de normalisatielaag:
  - “DUURZ A AMH EIDS” → “DUURZAAMHEIDS”
  - “ESG-DOSSI ER” → “ESG-DOSSIER”
  - “Slimme thermostaten draagt” → “Slimme thermostaten dragen”
  - “POTENTIEEL RENTE VOORDEEL” → “POTENTIEEL FINANCIERINGSVOORDEEL”
  - “materiaalkozen” → “materiaalkeuze”
  - te specifieke/onjuiste groendak-verwijzing vervangen door algemene dak-/gevelcontrole.

## Vercel

Benodigde environment variables:

- `OPENAI_API_KEY`
- `BLOB_READ_WRITE_TOKEN` of `BLOB2_READ_WRITE_TOKEN`

Uploadfunctionaliteit is behouden via de bestaande API-bestanden.
