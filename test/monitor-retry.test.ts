import { describe, expect, it, vi } from "vitest";
import { retryTransient } from "../scripts/monitor-retry";

describe("temporary source failures", () => {
  it("recovers when a malformed RSS response is followed by a healthy response", async () => {
    const operation = vi.fn().mockRejectedValueOnce(new Error("Invalid or unsupported RSS XML"))
      .mockResolvedValueOnce("complete snapshot");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await expect(retryTransient(operation, "johor", [0])).resolves.toBe("complete snapshot");
      expect(operation).toHaveBeenCalledTimes(2);
    } finally { warning.mockRestore(); }
  });

  it("recovers from a temporary PDF fetch failure", async () => {
    const operation = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce({ sha256: "verified" });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try { await expect(retryTransient(operation, "BKPP PDF", [0])).resolves.toEqual({ sha256: "verified" }); }
    finally { warning.mockRestore(); }
  });

  it("still fails on repeated errors and permanent invalid sources", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const temporary = vi.fn().mockRejectedValue(new Error("Source HTTP 503"));
      await expect(retryTransient(temporary, "source", [0, 0])).rejects.toThrow("503");
      expect(temporary).toHaveBeenCalledTimes(3);
      const permanent = vi.fn().mockRejectedValue(new Error("Unapproved source URL"));
      await expect(retryTransient(permanent, "source", [0, 0])).rejects.toThrow("Unapproved");
      expect(permanent).toHaveBeenCalledTimes(1);
    } finally { warning.mockRestore(); }
  });
});
