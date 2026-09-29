# Official-source monitoring

## What is monitored

For researched expansion candidates across all states and federal territories, see [Official announcement source research](announcement-sources.md). Perlis, Johor and Kedah are enabled as pilots; the other expansion candidates remain unconfigured.

The first monitor set covers the two most important Tier 1 BKPP indexes:

- annual federal and state holiday schedules;
- public-holiday acts, gazettes, amendments and special declarations.

The third source is the [Perlis official media-statement index](https://www.perlis.gov.my/index.php/suk-perlis/info-umum/media1/kenyataan-media). Its two-column table supplies the statement title and publication-date label. The date label is preserved as source context, never interpreted as the holiday date. The discovery index is registered as Tier 2; each relevant declaration still needs document-level authority and scope review before publication.

For Perlis, only official PDFs whose table title or filename contains `cuti`, `kelepasan am`, `public holiday(s)` or `special holiday(s)` are downloaded and compared. Denials and cancellations intentionally remain candidates. Unrelated statement additions do not create alerts. The report records `indexDocumentCount` before filtering; at least ten official document links must still be found in valid table rows, so a broken layout cannot silently look like an empty holiday list. Zero matching candidates is otherwise valid, and removal of an existing candidate still produces a review alert.

This keyword pilot can miss an announcement whose title and filename contain none of those terms, including image-only notices or a holiday first announced elsewhere. It does not assess the legal meaning of PDF contents. Check the index manually during the pilot to measure missed candidates and unnecessary alerts. The Perlis robots file was checked on 26 September 2026; the index and selected `/phocadownload/kenyataanmedia/` document path were not disallowed. The existing hourly schedule applies.

Initial Perlis observation: 14 unique eligible PDF URLs in table rows, of which one matched the holiday filter (the notice published 31 December 2024 about 1 January 2025). Its fingerprint establishes monitoring from onboarding; it does not add a 2025 holiday or change the API's supported years. See the baseline for the exact observation time.

The monitor fingerprints normalized official PDF links and downloads each linked PDF to compare its SHA-256 checksum. It detects revised documents even when the URL and title stay the same. Visitor counters, timestamps, scripts, styling and unrelated index-page text do not affect the link fingerprint.

Temporary network/server failures and malformed RSS responses are retried twice with a short backoff. A source that still fails is reported in the workflow log and evidence artifact; the run fails rather than treating a partial check as complete.

PDF checks compare bytes, not meaning: metadata-only changes can also trigger review. They do not extract holiday details or automatically publish records. Downloads are sequential, deduplicated within a run, limited to 25 MiB per PDF and 20 seconds per request (including reading the body), and restricted to HTTPS on configured official hosts, including redirects. HTTP errors, partial responses, non-PDF bodies and incomplete downloads fail the run and prevent baseline updates. No document copies are committed or included in artifacts.

## Johor and Kedah RSS archives

Both official feeds contain only ten recent entries. Every hourly run also reconciles all published posts through each site's public WordPress REST API, ordered by ID, with 100 posts per page. This avoids depending on a persistent last-seen cursor and catches older articles missed during an outage as long as they remain published. The adapter checks feed identities against the archive and fails on missing pagination headers, duplicate posts, inconsistent totals, missing feed articles or incomplete retrieval. Each source is limited to ten pages (1,000 posts), with at least ten posts expected; exceeding these bounds requires configuration review. Responses are limited to 8 MiB and 20 seconds, including reading the body. Robots rules were checked on 26 September 2026 for the feed and archive routes.

Candidates match the same holiday keywords in article titles, article text or resource URLs. Their text and resource URLs are hashed, and linked PDFs on approved HTTPS hosts are downloaded and fingerprinted. Johor PDF-viewer URLs are unpacked. Other PDF hosts appear as manual-review warnings. Content edits, candidate additions and removals trigger review; unrelated additions and markup-only changes do not. Reports include feed/archive counts and candidate counts. Dates from posts are publication dates, never inferred holiday dates.

The committed baseline remembers reviewed monitoring state. Pending changes recur with the same issue signature until reviewed; scheduled runs never accept them automatically. Initial onboarding recorded 18 Johor posts (two candidates) and 263 Kedah posts (eight candidates), plus three linked PDFs. This establishes future change detection, not validation of those historical announcements. The initial candidate inventory is retained in [RSS onboarding](rss-onboarding.md) for separate authority/date review, including 2026 announcements. No holiday records were added by onboarding.

Keyword matching is discovery only: incidental mentions, denials and cancellations can match. Image-only announcements, text inside PDFs without matching surrounding keywords, non-post pages, documents without a PDF URL suffix, and posts deleted before a check can be missed. Same-URL image byte changes are not monitored. This does not claim complete ad-hoc holiday coverage or perform Jev verification.

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

The baseline contains public source metadata: official URLs, titles, item identities, publication/modification dates, retrieval timestamps and content hashes. It contains no full article bodies. Review its diff before committing it.

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
