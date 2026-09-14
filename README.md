# Malaysia Public Holiday API

An evidence-first API for Malaysian public holidays, including late and special declarations.

This project is open source. Public development makes corrections and source provenance inspectable, but credentials, private contact information, unpublished operational notes and private notification destinations must never be committed.

## Current status

This repository is an initial local MVP. It contains:

- a source trust policy;
- an official-source registry;
- visually verified 2026 and 2027 federal and state source records from BKPP, Jabatan Perdana Menteri;
- a small Cloudflare Worker API;
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
GET http://localhost:8787/v1/jurisdictions
GET http://localhost:8787/v1/sources
GET http://localhost:8787/health
```

## Monitor official sources

```bash
npm run monitor
```

The monitor compares meaningful official PDF links with the reviewed baseline. It writes evidence under the ignored `output/monitor/` directory and never edits holiday data. Read [docs/monitoring.md](docs/monitoring.md) before accepting a detected change.

## Data principle

An announcement is not published as `confirmed` merely because a news outlet reports it. See [docs/source-policy.md](docs/source-policy.md).

Holiday rows retain their source identifier and PDF page. The API accepts either a jurisdiction slug such as `selangor` or its ISO subdivision code such as `MY-10`.

## Contributing

Corrections are welcome when accompanied by a primary government source. Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes.

## Licensing and source material

The software is licensed under the MIT License. Holiday facts include source and provenance metadata. Third-party publications, government documents, names and marks remain subject to their respective owners' terms; copies of source documents are not redistributed by this repository.

This service is informational and is not legal or employment advice.
