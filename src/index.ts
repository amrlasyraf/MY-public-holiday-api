import { Hono } from "hono";
import federal2026 from "../data/holidays/2026/federal.json";
import state2026 from "../data/holidays/2026/state.json";
import federal2027 from "../data/holidays/2027/federal.json";
import state2027 from "../data/holidays/2027/state.json";
import jurisdictions from "../data/jurisdictions.json";
import sources from "../data/sources.json";

type Applicability = { all: true; except?: string[] } | { only: string[] };

type Holiday = {
  id: string;
  date: string;
  nameMs: string;
  nameEn: string;
  classification: "federal" | "state" | "special";
  status: "confirmed" | "announced" | "provisional" | "cancelled";
  appliesTo: Applicability;
  sourcePage: number;
  sourceId: string;
};

const datasets = {
  2026: [federal2026, state2026],
  2027: [federal2027, state2027]
} as const;

const availableYears = Object.keys(datasets).map(Number);

function holidaysForYear(year: number): Holiday[] {
  const selected = datasets[year as keyof typeof datasets];
  if (!selected) return [];

  return selected.flatMap((dataset) => dataset.holidays.map((holiday) => ({
    ...holiday,
    sourceId: dataset.sourceId
  }))) as Holiday[];
}

function appliesTo(holiday: Holiday, jurisdictionCode: string): boolean {
  if ("only" in holiday.appliesTo) {
    return holiday.appliesTo.only.includes(jurisdictionCode);
  }
  return !(holiday.appliesTo.except ?? []).includes(jurisdictionCode);
}

export const app = new Hono();

app.get("/", (c) => c.json({ name: "Malaysia Public Holiday API", version: "0.2.0" }));
app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/v1/sources", (c) => c.json({ data: sources }));
app.get("/v1/jurisdictions", (c) => c.json({ data: jurisdictions }));

app.get("/v1/holidays", (c) => {
  const year = Number(c.req.query("year"));
  const stateQuery = c.req.query("state")?.toLowerCase();

  if (!Number.isInteger(year)) {
    return c.json({ error: "The year query parameter is required." }, 400);
  }

  const jurisdiction = stateQuery
    ? jurisdictions.find(({ slug, code }) => slug === stateQuery || code.toLowerCase() === stateQuery)
    : undefined;

  if (stateQuery && !jurisdiction) {
    return c.json({
      error: "Unknown state or federal territory.",
      validStates: jurisdictions.map(({ slug }) => slug)
    }, 400);
  }

  let data = holidaysForYear(year);
  if (jurisdiction) {
    data = data.filter((holiday) => appliesTo(holiday, jurisdiction.code));
  }
  data.sort((a, b) => a.date.localeCompare(b.date) || a.nameMs.localeCompare(b.nameMs));

  return c.json({
    data,
    meta: {
      year,
      jurisdiction: jurisdiction ?? null,
      availableYears,
      recordSemantics: "Declared dates only; observed or replacement days are not inferred."
    }
  });
});

export default app;
