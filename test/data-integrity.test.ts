import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import federal2026 from "../data/holidays/2026/federal.json";
import state2026 from "../data/holidays/2026/state.json";
import federal2027 from "../data/holidays/2027/federal.json";
import state2027 from "../data/holidays/2027/state.json";
import jurisdictions from "../data/jurisdictions.json";
import schema from "../schemas/holiday.schema.json";

const datasets = [federal2026, state2026, federal2027, state2027];
const records = datasets.flatMap((dataset) => dataset.holidays);

describe("holiday data integrity", () => {
  it("matches the public record schema", () => {
    const ajv = new Ajv2020({ allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    for (const record of records) {
      expect(validate(record), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it("uses unique IDs and dates from the containing year", () => {
    expect(new Set(records.map(({ id }) => id)).size).toBe(records.length);
    for (const dataset of datasets) {
      for (const holiday of dataset.holidays) {
        expect(holiday.date.startsWith(`${dataset.year}-`)).toBe(true);
      }
    }
  });

  it("references only known jurisdiction codes", () => {
    const validCodes = new Set(jurisdictions.map(({ code }) => code));
    for (const holiday of records) {
      const rule = holiday.appliesTo as { only?: string[]; except?: string[] };
      for (const code of [...(rule.only ?? []), ...(rule.except ?? [])]) {
        expect(validCodes.has(code), `${holiday.id}: ${code}`).toBe(true);
      }
    }
  });
});
