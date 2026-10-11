import { Hono } from "hono";
import federal2026 from "../data/holidays/2026/federal.json";
import state2026 from "../data/holidays/2026/state.json";
import federal2027 from "../data/holidays/2027/federal.json";
import state2027 from "../data/holidays/2027/state.json";
import changes from "../data/changes.json";
import jurisdictions from "../data/jurisdictions.json";
import monitorBaseline from "../data/monitor/baseline.json";
import monitorConfig from "../data/monitor/config.json";
import releases from "../data/releases.json";
import sources from "../data/sources.json";
import { openApiDocument } from "./openapi";
import { siteHtml } from "./site";

type Applicability = { all: true; except?: string[] } | { only: string[] };
type Holiday = {
  id: string; date: string; nameMs: string; nameEn: string;
  classification: "federal" | "state" | "special";
  status: "confirmed" | "announced" | "provisional" | "cancelled";
  appliesTo: Applicability; sourcePage: number; sourceId: string;
};

const datasets = { 2026: [federal2026, state2026], 2027: [federal2027, state2027] } as const;
const availableYears = Object.keys(datasets).map(Number);
const sourceById = new Map(sources.map((source) => [source.id, source]));
const releaseByYear = new Map(releases.map((release) => [release.year, release]));

function holidaysForYear(year: number): Holiday[] {
  const selected = datasets[year as keyof typeof datasets];
  if (!selected) return [];
  return selected.flatMap((dataset) => dataset.holidays.map((holiday) => ({ ...holiday, sourceId: dataset.sourceId }))) as Holiday[];
}

function appliesTo(holiday: Holiday, code: string): boolean {
  if ("only" in holiday.appliesTo) return holiday.appliesTo.only.includes(code);
  return !(holiday.appliesTo.except ?? []).includes(code);
}

function findJurisdiction(query: string | undefined) {
  const normalized = query?.toLowerCase();
  return normalized ? jurisdictions.find(({ slug, code }) => slug === normalized || code.toLowerCase() === normalized) : undefined;
}

function enrichHoliday(holiday: Holiday) {
  const source = sourceById.get(holiday.sourceId);
  const release = releaseByYear.get(Number(holiday.date.slice(0, 4)));
  return {
    ...holiday, revision: 1, recordedAt: release?.recordedAt ?? null,
    source: source ? {
      id: source.id, name: source.name, authority: source.authority, url: source.url,
      tier: source.tier, page: holiday.sourcePage,
      sha256: "checksum" in source ? source.checksum : null
    } : null
  };
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let limit = 75;
  for (const character of line) {
    if (encoder.encode(current + character).length > limit) {
      parts.push(current); current = character; limit = 74;
    } else current += character;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function nextDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function compactDate(value: string): string { return value.replaceAll("-", ""); }

function calendarFor(year: number, jurisdiction: (typeof jurisdictions)[number], holidays: Holiday[]): string {
  const release = releaseByYear.get(year);
  const dtstamp = new Date(release?.recordedAt ?? "2026-09-14T00:00:00+08:00")
    .toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Malaysia Public Holiday API//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:Malaysia Public Holidays - ${jurisdiction.name} ${year}`,
    `X-WR-CALDESC:Declared dates only. Release ${release?.id ?? "unknown"}.`
  ];
  for (const holiday of holidays) {
    const source = sourceById.get(holiday.sourceId);
    lines.push(
      "BEGIN:VEVENT", `UID:${holiday.id}@malaysia-public-holiday-api`, `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${compactDate(holiday.date)}`, `DTEND;VALUE=DATE:${compactDate(nextDate(holiday.date))}`,
      `SUMMARY:${icsEscape(holiday.nameEn)}`,
      `DESCRIPTION:${icsEscape(`${holiday.nameMs} | ${holiday.status} | Source: ${source?.url ?? holiday.sourceId} page ${holiday.sourcePage}`)}`,
      `X-MY-STATUS:${holiday.status}`, `X-MY-CLASSIFICATION:${holiday.classification}`,
      `X-MY-SOURCE-ID:${holiday.sourceId}`, "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const app = new Hono();

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff"); c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Frame-Options", "DENY"); c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Access-Control-Allow-Origin", "*"); c.header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  c.header("Access-Control-Allow-Headers", "If-None-Match"); c.header("Access-Control-Expose-Headers", "ETag");
  c.header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
});

app.options("*", (c) => c.body(null, 204));
app.get("/", (c) => c.html(siteHtml));
app.get("/docs", (c) => c.html(siteHtml));
app.get("/openapi.json", (c) => c.json(openApiDocument));
app.get("/v1", (c) => c.json({ name: "Malaysia Public Holiday API", version: "0.4.0", documentation: "/docs", openapi: "/openapi.json" }));
app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/v1/sources", (c) => c.json({ data: sources }));
app.get("/v1/jurisdictions", (c) => c.json({ data: jurisdictions }));

app.get("/v1/holidays", (c) => {
  const year = Number(c.req.query("year")); const stateQuery = c.req.query("state");
  if (!Number.isInteger(year)) return c.json({ error: "The year query parameter is required." }, 400);
  if (!availableYears.includes(year)) return c.json({ error: `No published dataset is available for ${year}.`, availableYears }, 400);
  const jurisdiction = findJurisdiction(stateQuery);
  if (stateQuery && !jurisdiction) return c.json({ error: "Unknown state or federal territory.", validStates: jurisdictions.map(({ slug }) => slug) }, 400);
  let data = holidaysForYear(year);
  if (jurisdiction) data = data.filter((holiday) => appliesTo(holiday, jurisdiction.code));
  data.sort((a, b) => a.date.localeCompare(b.date) || a.nameMs.localeCompare(b.nameMs));
  c.header("Cache-Control", "public, max-age=3600");
  return c.json({ data: data.map(enrichHoliday), meta: {
    year, jurisdiction: jurisdiction ?? null, availableYears, release: releaseByYear.get(year) ?? null,
    recordSemantics: "Declared dates only; observed or replacement days are not inferred."
  } });
});

app.get("/v1/holidays/check", (c) => {
  const date = c.req.query("date") ?? ""; const stateQuery = c.req.query("state");
  if (!isIsoDate(date)) return c.json({ error: "A valid date in YYYY-MM-DD format is required." }, 400);
  const year = Number(date.slice(0, 4));
  if (!availableYears.includes(year)) return c.json({ error: `No published dataset is available for ${year}.`, availableYears }, 400);
  const jurisdiction = findJurisdiction(stateQuery);
  if (!stateQuery || !jurisdiction) return c.json({ error: "A valid state query parameter is required for an explainable result.", validStates: jurisdictions.map(({ slug }) => slug) }, 400);
  const matches = holidaysForYear(year).filter((holiday) => holiday.date === date && appliesTo(holiday, jurisdiction.code)).sort((a, b) => a.nameMs.localeCompare(b.nameMs));
  const names = matches.map((holiday) => holiday.nameEn).join("; ");
  return c.json({
    date, jurisdiction, isHoliday: matches.length > 0, holidays: matches.map(enrichHoliday),
    explanation: matches.length ? `${date} is a declared public-holiday date in ${jurisdiction.name}: ${names}.` : `${date} does not match a declared public-holiday date in ${jurisdiction.name} in the available dataset.`,
    warnings: ["This checks declared dates only. Replacement, observed, employer-selected, and closure days are not inferred."]
  });
});

app.get("/v1/changes", (c) => {
  const since = c.req.query("since"); const yearQuery = c.req.query("year");
  const year = yearQuery === undefined ? undefined : Number(yearQuery);
  if (since && Number.isNaN(Date.parse(since))) return c.json({ error: "The since parameter must be a valid ISO 8601 timestamp." }, 400);
  if (yearQuery !== undefined && !Number.isInteger(year)) return c.json({ error: "The year parameter must be an integer." }, 400);
  const data = changes.filter((change) => (!since || Date.parse(change.occurredAt) > Date.parse(since)) && (year === undefined || change.year === year));
  return c.json({ data, meta: { count: data.length, historyBeginsAt: "2026-09-14T00:00:00+08:00", semantics: "occurredAt records when this project accepted a change, not when a government source was first published." } });
});

app.get("/v1/calendars/:filename", async (c) => {
  const filename = c.req.param("filename");
  if (!filename.endsWith(".ics")) return c.notFound();
  const jurisdiction = findJurisdiction(filename.slice(0, -4)); const year = Number(c.req.query("year"));
  if (!jurisdiction) return c.json({ error: "Unknown state or federal territory.", validStates: jurisdictions.map(({ slug }) => slug) }, 400);
  if (!Number.isInteger(year) || !availableYears.includes(year)) return c.json({ error: `The year query parameter must be one of: ${availableYears.join(", ")}.` }, 400);
  const data = holidaysForYear(year).filter((holiday) => appliesTo(holiday, jurisdiction.code)).sort((a, b) => a.date.localeCompare(b.date));
  const calendar = calendarFor(year, jurisdiction, data); const etag = `"${await sha256(calendar)}"`;
  if (c.req.header("If-None-Match") === etag) return c.body(null, 304);
  c.header("Content-Type", "text/calendar; charset=utf-8"); c.header("Content-Disposition", `inline; filename="malaysia-${jurisdiction.slug}-${year}.ics"`);
  c.header("Cache-Control", "public, max-age=3600"); c.header("ETag", etag);
  return c.body(calendar);
});

app.get("/v1/status", (c) => {
  const snapshots = Object.values(monitorBaseline.sources);
  return c.json({
    status: "operational", publishingMode: "review-first",
    monitoring: {
      schedule: "hourly", activeSourceCount: monitorConfig.length,
      registeredMonitoredSourceCount: sources.filter((source) => source.monitor).length,
      baselineSnapshotCount: snapshots.length, baselineAcceptedAt: monitorBaseline.updatedAt,
      snapshots: snapshots.map(({ sourceId, sourceUrl, hash, links }) => ({ sourceId, sourceUrl, sha256: hash, discoveredLinkCount: links.length })),
      caveat: "Baseline timestamps describe the accepted comparison state, not the latest successful workflow run. Detected changes require human review before publication."
    },
    releases, workflow: "https://github.com/amrlasyraf/MY-public-holiday-api/actions/workflows/monitor.yml"
  });
});

export default app;
