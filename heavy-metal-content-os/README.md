# Heavy Metal — Content OS

Internal app for the Heavy Metal content team: archive, ideation, production, rights, calendar, campaigns, paid handoff and performance. It runs on the **Heavy Metal Content Hub** strategy (Notion). See `ARCHITECTURE.md` for sections A–I.

## Run it

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY to switch on AI features
npm run build && npm start   # or: npm run dev
```

Data lives in `storage/` (SQLite database, PDFs, thumbnails, assets). Set `HM_DATA_DIR` to put it elsewhere. Requires Node 22+ and `pdftoppm` (poppler-utils) for page thumbnails.

## What works without an API key
Archive upload (text and thumbnails), search, manual cataloguing and verification, every rule check and stage gate, pipeline, calendar and cadence warnings, rights, run log, campaigns, paid tracker, analytics (manual entry), Instagram preview (simulated, labelled).

## What needs `ANTHROPIC_API_KEY`
Contents/credit extraction on upload, natural-language search, franchise recommendations, Carousel Creator, Video Brief, Idea Generator, Friday review observations, and the Heavy Metal AI assistant. Without a key these show as **Not connected**. Nothing is simulated.

## Rulebook
- `data/franchises.json`: the 19 franchises as extracted from Notion (`data/franchises-extraction-notes.md` lists sources and gaps). Seeded once; after that, edit them in **Settings**.
- `src/lib/rules/index.ts`: the enforced rules (job required, franchise checks, rights gate, six-week schedule, cadence, run-log repetition).
