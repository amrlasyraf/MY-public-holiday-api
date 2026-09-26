# Official-source monitoring

## What is monitored

The first monitor set covers the two most important Tier 1 BKPP indexes:

- annual federal and state holiday schedules;
- public-holiday acts, gazettes, amendments and special declarations.

The monitor fingerprints normalized official PDF links and downloads each linked PDF to compare its SHA-256 checksum. It detects revised documents even when the URL and title stay the same. Visitor counters, timestamps, scripts, styling and unrelated index-page text do not affect the link fingerprint.

PDF checks compare bytes, not meaning: metadata-only changes can also trigger review. They do not extract holiday details or automatically publish records. Downloads are sequential, deduplicated within a run, limited to 25 MiB per PDF and 20 seconds per request (including reading the body), and restricted to HTTPS on configured official hosts, including redirects. HTTP errors, partial responses, non-PDF bodies and incomplete downloads fail the run and prevent baseline updates. No document copies are committed or included in artifacts.

## Local commands

Check for changes:

```bash
npm run monitor
```

Exit codes:

- `0`: all sources and PDFs were checked with no changes, or an explicitly requested baseline operation succeeded;
- `1`: one or more sources/PDFs could not be checked, or the content baseline needs initialization;
- `2`: a source changed and human review is required.

Reports are written to `output/monitor/report.json` and `output/monitor/report.md`. JSON reports include per-source snapshots, PDF byte counts and checksums, changed-content checksums, and any failures. Successful downloads without a previous checksum are identified separately as first observations. This directory is deliberately ignored by Git because reports are run-specific evidence.

### Initialize an older link-only baseline

Run `npm run monitor` first and inspect the report. Then run:

```bash
npm run monitor:initialize-content
```

This adds the first PDF fingerprints without treating them as historical verification. Existing SHA-256 checksums in `data/sources.json` are reused when the old baseline has none. Initialization refuses to write if an index or a previously recorded PDF checksum changed, or any download failed. Review and commit the resulting baseline before the hourly workflow uses it. First observations cannot establish whether an untracked PDF changed before initialization.

After inspecting every added, removed, retitled or content-changed document and resolving any required holiday-data change, accept the current official index and PDF state with:

```bash
npm run monitor:update-baseline
```

The baseline is public metadata containing only official URLs, hashes and retrieval timestamps. Review its diff before committing it.

## GitHub automation

`.github/workflows/monitor.yml` runs hourly. A unique change signature creates one GitHub issue, so repeated checks against the same unreviewed change do not create duplicate issues. Each run uploads its report for 30 days.

The workflow has only read access to repository contents and write access to issues. It cannot change holiday records or the baseline.

## Required human review

For each alert:

1. Download the newly linked or content-changed document from the official host. Compare the reported checksum; a later download may have changed again.
2. Confirm the declaring authority, legal basis, date and affected jurisdiction.
3. Determine whether it adds, amends, replaces or cancels a record.
4. Add a new revision or source-backed record and tests.
5. Run all validation.
6. Update the monitor baseline only after the alert is fully resolved.
7. Close the review issue with a link to the correcting commit or an explanation that no data change was required.

An added link is evidence of a source-page change, not proof that a holiday exists.
