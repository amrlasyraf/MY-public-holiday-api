const stateParameter = { name: "state", in: "query", required: true, description: "Jurisdiction slug or ISO 3166-2 subdivision code", schema: { type: "string", example: "selangor" } } as const;

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Malaysia Public Holiday API", version: "0.4.0",
    description: "A source-backed Malaysian public-holiday changefeed with state calendars and explainable date checks. Declared dates are returned without inferring replacement days."
  },
  servers: [{ url: "/", description: "Current server" }],
  paths: {
    "/v1/holidays": { get: {
      summary: "List source-enriched holiday records",
      parameters: [
        { name: "year", in: "query", required: true, schema: { type: "integer", enum: [2026, 2027] } },
        { ...stateParameter, required: false }
      ],
      responses: { "200": { description: "Holiday records, source evidence, and release metadata" }, "400": { description: "Invalid query" } }
    } },
    "/v1/holidays/check": { get: {
      summary: "Explain whether one date is a declared holiday in one jurisdiction",
      parameters: [
        { name: "date", in: "query", required: true, schema: { type: "string", format: "date", example: "2026-05-30" } },
        stateParameter
      ],
      responses: { "200": { description: "Boolean result, matching records, evidence, explanation, and semantic warnings" }, "400": { description: "Invalid date or jurisdiction" } }
    } },
    "/v1/changes": { get: {
      summary: "Read the immutable project change history",
      parameters: [
        { name: "since", in: "query", required: false, schema: { type: "string", format: "date-time" } },
        { name: "year", in: "query", required: false, schema: { type: "integer" } }
      ],
      responses: { "200": { description: "Accepted publication events after the requested timestamp" }, "400": { description: "Invalid query" } }
    } },
    "/v1/calendars/{state}.ics": { get: {
      summary: "Download a state-specific RFC 5545 calendar",
      parameters: [
        { name: "state", in: "path", required: true, schema: { type: "string", example: "selangor" } },
        { name: "year", in: "query", required: true, schema: { type: "integer", enum: [2026, 2027] } }
      ],
      responses: { "200": { description: "iCalendar feed with stable event IDs and validators" }, "304": { description: "Calendar has not changed" }, "400": { description: "Invalid query" } }
    } },
    "/v1/status": { get: { summary: "Inspect monitor baselines and published data releases", responses: { "200": { description: "Review-first publishing and source-monitor metadata" } } } },
    "/v1/jurisdictions": { get: { summary: "List supported jurisdictions", responses: { "200": { description: "All 13 states and three federal territories" } } } },
    "/v1/sources": { get: { summary: "List registered sources and checksums", responses: { "200": { description: "Primary and corroborating source registry" } } } },
    "/health": { get: { summary: "Service health check", responses: { "200": { description: "Service is healthy" } } } }
  }
} as const;
