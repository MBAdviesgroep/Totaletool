# MB Verduurzaming + ESG Tool

Dit pakket combineert de beste onderdelen van beide tools:

- `index.html`: frontend op basis van de verduurzamingstool, aangevuld met ESG/SDG- en financieringsrapportlaag.
- `api/upload.js`: Vercel Blob uploadroute uit de duurzaamheidstool.
- `api/generate-report.js`: gecombineerde AI-route. De duurzaamheidsprompt blijft leidend, maar wordt automatisch aangevuld met ESG/SDG/bank- en financieringsinstructies.
- `package.json`: dependencies voor OpenAI en Vercel Blob.

## Benodigde environment variables op Vercel

- `OPENAI_API_KEY`
- `BLOB_READ_WRITE_TOKEN`

## Deploy

Upload deze map naar GitHub en deploy via Vercel. Zet daarna bovenstaande environment variables in Vercel.
