# Official-source monitoring

## What is monitored

The first monitor set covers the two most important Tier 1 BKPP indexes:

- annual federal and state holiday schedules;
- public-holiday acts, gazettes, amendments and special declarations.

The monitor fingerprints normalized official PDF links. Visitor counters, timestamps, scripts, styling and unrelated page text do not affect the fingerprint.

## Local commands

Check for changes:

```bash
npm run monitor
```

Exit codes:

- `0`: sources were checked and no meaningful change was found;
- `1`: one or more sources could not be checked;
- `2`: a source changed and human review is required.

Reports are written to `output/monitor/report.json` and `output/monitor/report.md`. This directory is deliberately ignored by Git because reports are run-specific evidence.

After inspecting every added, removed or retitled document and resolving any required holiday-data change, accept the current official index state with:

```bash
npm run monitor:update-baseline
```

The baseline is public metadata containing only official URLs, hashes and retrieval timestamps. Review its diff before committing it.

## GitHub automation

`.github/workflows/monitor.yml` runs hourly. A unique change signature creates one GitHub issue, so repeated checks against the same unreviewed change do not create duplicate issues. Each run uploads its report for 30 days.

The workflow has only read access to repository contents and write access to issues. It cannot change holiday records or the baseline.

## Required human review

For each alert:

1. Download the newly linked document from the official host.
2. Confirm the declaring authority, legal basis, date and affected jurisdiction.
3. Determine whether it adds, amends, replaces or cancels a record.
4. Add a new revision or source-backed record and tests.
5. Run all validation.
6. Update the monitor baseline only after the alert is fully resolved.
7. Close the review issue with a link to the correcting commit or an explanation that no data change was required.

An added link is evidence of a source-page change, not proof that a holiday exists.
