import { describe, expect, it } from "vitest";
import { app } from "../src/index";

type ApiHoliday = { id: string; date: string; nameMs: string; classification: string; revision: number; source: { url: string; sha256: string } };
type HolidayResponse = { data: ApiHoliday[]; meta: { availableYears: number[] } };

async function holidays(path: string): Promise<HolidayResponse> {
  return await (await app.request(path)).json() as HolidayResponse;
}

describe("holiday API", () => {
  it("serves the public website with security headers", async () => {
    const response = await app.request("/");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(await response.text()).toContain("Is it a public holiday?");
  });

  it("publishes an OpenAPI document", async () => {
    const response = await app.request("/openapi.json");
    const body = await response.json() as { openapi: string; paths: Record<string, unknown> };
    expect(body.openapi).toBe("3.1.0");
    expect(body.paths).toHaveProperty("/v1/holidays");
    expect(body.paths).toHaveProperty("/v1/changes");
    expect(body.paths).toHaveProperty("/v1/calendars/{state}.ics");
  });

  it("requires a year", async () => {
    const response = await app.request("/v1/holidays");
    expect(response.status).toBe(400);
    expect((await app.request("/v1/holidays?year=2025")).status).toBe(400);
  });

  it("returns all official source rows for 2026 and 2027", async () => {
    const year2026 = await holidays("/v1/holidays?year=2026");
    const year2027 = await holidays("/v1/holidays?year=2027");
    expect(year2026.data).toHaveLength(51);
    expect(year2027.data).toHaveLength(52);
    expect(year2027.meta.availableYears).toEqual([2026, 2027]);
  });

  it("exposes all 16 jurisdictions", async () => {
    const response = await app.request("/v1/jurisdictions");
    const body = await response.json() as { data: unknown[] };
    expect(body.data).toHaveLength(16);
  });

  it("rejects an unknown jurisdiction", async () => {
    const response = await app.request("/v1/holidays?year=2026&state=not-a-state");
    expect(response.status).toBe(400);
  });

  it("excludes Deepavali for Sarawak", async () => {
    const body = await holidays("/v1/holidays?year=2026&state=sarawak");
    expect(body.data.some((holiday) => holiday.id === "my-2026-deepavali")).toBe(false);
  });

  it("resolves the federal and state second-day Aidiladha split", async () => {
    for (const state of ["kedah", "kelantan", "perlis", "terengganu"]) {
      const body = await holidays(`/v1/holidays?year=2026&state=${state}`);
      expect(body.data.filter((holiday) => holiday.date === "2026-05-28")).toHaveLength(1);
    }
    const selangor = await holidays("/v1/holidays?year=2026&state=selangor");
    expect(selangor.data.some((holiday) => holiday.date === "2026-05-28")).toBe(false);
  });

  it("resolves Chinese New Year day two for every jurisdiction", async () => {
    const response = await app.request("/v1/jurisdictions");
    const body = await response.json() as { data: Array<{ slug: string }> };

    for (const { slug } of body.data) {
      const state = await holidays(`/v1/holidays?year=2027&state=${slug}`);
      expect(state.data.filter((holiday) => holiday.date === "2027-02-07")).toHaveLength(1);
    }
  });

  it("keeps both Israk and Mikraj dates in Negeri Sembilan in 2027", async () => {
    const body = await holidays("/v1/holidays?year=2027&state=negeri-sembilan");
    const dates = body.data
      .filter((holiday) => holiday.nameMs === "Israk dan Mikraj")
      .map((holiday) => holiday.date);
    expect(dates).toEqual(["2027-01-06", "2027-12-26"]);
  });

  it("attaches auditable source evidence to every holiday", async () => {
    const body = await holidays("/v1/holidays?year=2026&state=selangor");
    expect(body.data[0].revision).toBe(1);
    expect(body.data[0].source.url).toMatch(/^https:\/\/www\.kabinet\.gov\.my\//);
    expect(body.data[0].source.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("explains positive and negative date checks without inferring replacements", async () => {
    const positive = await (await app.request("/v1/holidays/check?date=2026-05-30&state=sabah")).json() as { isHoliday: boolean; explanation: string; warnings: string[] };
    expect(positive.isHoliday).toBe(true);
    expect(positive.explanation).toContain("Harvest Festival");
    expect(positive.warnings[0]).toContain("Replacement");

    const negative = await (await app.request("/v1/holidays/check?date=2026-05-30&state=selangor")).json() as { isHoliday: boolean };
    expect(negative.isHoliday).toBe(false);
    expect((await app.request("/v1/holidays/check?date=2026-02-30&state=sabah")).status).toBe(400);
    expect((await app.request("/v1/holidays/check?date=2025-05-30&state=sabah")).status).toBe(400);
  });

  it("publishes a filterable baseline changefeed with honest timestamp semantics", async () => {
    const response = await app.request("/v1/changes?year=2027");
    const body = await response.json() as { data: Array<{ type: string }>; meta: { semantics: string } };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].type).toBe("baseline_import");
    expect(body.meta.semantics).toContain("this project accepted");
    const after = await (await app.request("/v1/changes?since=2026-09-14T00:00:00%2B08:00")).json() as { data: unknown[] };
    expect(after.data).toHaveLength(0);
  });

  it("serves stable state calendars with cache validators", async () => {
    const response = await app.request("/v1/calendars/selangor.ics?year=2026");
    const calendar = await response.text();
    expect(response.headers.get("content-type")).toContain("text/calendar");
    expect(calendar).toContain("BEGIN:VCALENDAR\r\n");
    expect(calendar).toContain("Birthday of the Sultan of Selangor");
    expect(calendar).not.toContain("Harvest Festival");
    const etag = response.headers.get("etag");
    expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    const cached = await app.request("/v1/calendars/selangor.ics?year=2026", { headers: { "If-None-Match": etag! } });
    expect(cached.status).toBe(304);
  });

  it("exposes review-first monitor state without claiming a live last-check", async () => {
    const response = await app.request("/v1/status");
    const body = await response.json() as { publishingMode: string; monitoring: { caveat: string; baselineSnapshotCount: number; activeSourceCount: number } };
    expect(body.publishingMode).toBe("review-first");
    expect(body.monitoring.baselineSnapshotCount).toBe(2);
    expect(body.monitoring.activeSourceCount).toBe(2);
    expect(body.monitoring.caveat).toContain("not the latest successful workflow run");
  });

  it("allows browser clients through CORS", async () => {
    const response = await app.request("/v1/holidays?year=2026");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});
