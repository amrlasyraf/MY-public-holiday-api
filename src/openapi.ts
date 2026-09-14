export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Malaysia Public Holiday API",
    version: "0.3.0",
    description: "Source-backed federal and state public-holiday records for Malaysia. Declared dates are returned without inferring replacement days."
  },
  servers: [{ url: "/", description: "Current server" }],
  paths: {
    "/v1/holidays": {
      get: {
        summary: "List holiday records",
        parameters: [
          { name: "year", in: "query", required: true, schema: { type: "integer", enum: [2026, 2027] } },
          { name: "state", in: "query", required: false, description: "Jurisdiction slug or ISO 3166-2 subdivision code", schema: { type: "string", example: "selangor" } }
        ],
        responses: {
          "200": { description: "Holiday records and query metadata" },
          "400": { description: "Missing year or unknown jurisdiction" }
        }
      }
    },
    "/v1/jurisdictions": {
      get: { summary: "List supported jurisdictions", responses: { "200": { description: "All 13 states and three federal territories" } } }
    },
    "/v1/sources": {
      get: { summary: "List registered sources", responses: { "200": { description: "Primary and corroborating source registry" } } }
    },
    "/health": {
      get: { summary: "Service health check", responses: { "200": { description: "Service is healthy" } } }
    }
  }
} as const;
