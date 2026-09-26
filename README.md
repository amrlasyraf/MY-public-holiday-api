# Malaysia Public Holiday API

Malaysia's source-backed public-holiday changefeed: when the calendar changes, your systems can know.

This project is open source. Public development makes corrections and source provenance inspectable, but credentials, private contact information, unpublished operational notes and private notification destinations must never be committed.

The Worker also serves a responsive website and interactive holiday explorer at `/`, plus an OpenAPI 3.1 document at `/openapi.json`.

## Current status

This repository is an initial local MVP. It contains:

- a source trust policy;
- an official-source registry;
- visually verified 2026 and 2027 federal and state source records from BKPP, Jabatan Perdana Menteri;
- a Cloudflare Worker API with change history, explainable checks, and state-specific iCalendar feeds;
- schema and API tests.

The source schedule is normalized for all 13 states and three federal territories. Declared dates are included; observed/replacement dates remain deliberately separate and are not inferred yet.

## Run locally

```bash
npm install
npm test
npm run dev
```

Then try:

```text
GET http://localhost:8787/v1/holidays?year=2026
GET http://localhost:8787/v1/holidays?year=2026&state=sarawak
GET http://localhost:8787/v1/holidays?year=2027&state=MY-10
GET http://localhost:8787/v1/holidays/check?date=2026-05-30&state=sabah
GET http://localhost:8787/v1/changes?since=2026-09-14T00:00:00%2B08:00
GET http://localhost:8787/v1/calendars/selangor.ics?year=2026
GET http://localhost:8787/v1/status
GET http://localhost:8787/v1/jurisdictions
GET http://localhost:8787/v1/sources
GET http://localhost:8787/health
```

## Monitor official sources

```bash
npm run monitor
```

The monitor checks two BKPP indexes, selected Perlis statements, and Johor/Kedah RSS feeds with full published-post archive reconciliation. It compares article text, official PDF links and downloaded PDF checksums with the baseline, including revisions at unchanged URLs. It writes evidence under the ignored `output/monitor/` directory and never edits holiday data. Read [docs/monitoring.md](docs/monitoring.md) before accepting a detected change.

## Data principle

An announcement is not published as `confirmed` merely because a news outlet reports it. See [docs/source-policy.md](docs/source-policy.md).

Holiday rows retain their source identifier, PDF page, source checksum, revision, and accepted release time. The changefeed begins with the project's 14 September 2026 baseline and does not misrepresent that timestamp as an original government publication date. The API accepts either a jurisdiction slug such as `selangor` or its ISO subdivision code such as `MY-10`.

## Contributing

Corrections are welcome when accompanied by a primary government source. Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes.

## Licensing and source material

The software is licensed under the MIT License. Holiday facts include source and provenance metadata. Third-party publications, government documents, names and marks remain subject to their respective owners' terms; copies of source documents are not redistributed by this repository.

This service is informational and is not legal or employment advice.
