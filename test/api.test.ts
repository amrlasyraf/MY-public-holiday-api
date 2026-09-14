import { describe, expect, it } from "vitest";
import { app } from "../src/index";

type ApiHoliday = { id: string; date: string; nameMs: string; classification: string };
type HolidayResponse = { data: ApiHoliday[]; meta: { availableYears: number[] } };

async function holidays(path: string): Promise<HolidayResponse> {
  return await (await app.request(path)).json() as HolidayResponse;
}

describe("holiday API", () => {
  it("requires a year", async () => {
    const response = await app.request("/v1/holidays");
    expect(response.status).toBe(400);
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
});
