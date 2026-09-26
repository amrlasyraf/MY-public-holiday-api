import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { changeSignature, compareSnapshots, extractMeaningfulLinks, fetchPdfFingerprint, snapshotFromHtml, type MonitorConfig } from "../scripts/monitor";

const config: MonitorConfig = {
  id: "test-source",
  name: "Test source",
  url: "https://www.kabinet.gov.my/holidays/",
  allowedHosts: ["www.kabinet.gov.my"],
  includeUrlPattern: "\\.pdf(?:$|\\?)",
  minimumLinks: 1,
  trustTier: 1
};

describe("official source monitor", () => {
  it("keeps only allowed official PDF links", () => {
    const html = `
      <a href="/files/notice.pdf?utm_source=x">Notice 2027</a>
      <a href="https://evil.example/fake.pdf">Fake</a>
      <a href="/news">News</a>
      <a href="javascript:alert(1)">Bad</a>`;
    expect(extractMeaningfulLinks(html, config)).toEqual([
      { title: "Notice 2027", url: "https://www.kabinet.gov.my/files/notice.pdf" }
    ]);
  });

  it("ignores unrelated page changes", () => {
    const first = snapshotFromHtml(config, '<p>Visitors: 10</p><a href="/a.pdf">A</a>', "2026-01-01T00:00:00Z");
    const second = snapshotFromHtml(config, '<p>Visitors: 99</p><a href="/a.pdf">A</a>', "2026-01-02T00:00:00Z");
    expect(first.hash).toBe(second.hash);
    expect(compareSnapshots(config, first, second)).toBeNull();
  });

  it("reports added and removed official documents", () => {
    const first = snapshotFromHtml(config, '<a href="/old.pdf">Old</a>', "2026-01-01T00:00:00Z");
    const second = snapshotFromHtml(config, '<a href="/new.pdf">New</a>', "2026-01-02T00:00:00Z");
    const change = compareSnapshots(config, first, second);
    expect(change?.added.map(({ title }) => title)).toEqual(["New"]);
    expect(change?.removed.map(({ title }) => title)).toEqual(["Old"]);
  });

  it("detects changed bytes at the same URL and title, with distinct alert signatures", () => {
    const first = snapshotFromHtml(config, '<a href="/a.pdf">A</a>', "2026-01-01T00:00:00Z");
    const url = first.links[0].url;
    first.documents = { [url]: { sha256: "old", bytes: 12 } };
    const second = { ...first, documents: { [url]: { sha256: "new", bytes: 12 } } };
    const change = compareSnapshots(config, first, second)!;
    expect(change.added).toEqual([]);
    expect(change.removed).toEqual([]);
    expect(change.contentChanged).toEqual([{ url, title: "A", previousSha256: "old", currentSha256: "new" }]);
    const third = { ...first, documents: { [url]: { sha256: "newer", bytes: 12 } } };
    expect(changeSignature([change])).not.toBe(changeSignature([compareSnapshots(config, first, third)!]));
    expect(changeSignature([change])).toBe(changeSignature([compareSnapshots(config, first, second)!]));
    expect(compareSnapshots(config, second, { ...second, checkedAt: "later" })).toBeNull();
  });

  it("does not label first-time PDF fingerprints as document revisions", () => {
    const first = snapshotFromHtml(config, '<a href="/a.pdf">A</a>', "2026-01-01T00:00:00Z");
    const second = { ...first, documents: { [first.links[0].url]: { sha256: "first", bytes: 10 } } };
    expect(compareSnapshots(config, first, second)).toBeNull();
  });

  it("hashes downloaded bytes even when HTTP validators stay unchanged", async () => {
    const bytes = "%PDF-1.7\nfirst document";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(bytes, { headers: { etag: "same" } }))
      .mockResolvedValueOnce(new Response("%PDF-1.7\nrevised document", { headers: { etag: "same" } }));
    const first = await fetchPdfFingerprint("https://www.kabinet.gov.my/a.pdf", config, fetcher);
    const next = await fetchPdfFingerprint("https://www.kabinet.gov.my/a.pdf", config, fetcher);
    expect(first).toEqual({ sha256: createHash("sha256").update(bytes).digest("hex"), bytes: Buffer.byteLength(bytes) });
    expect(next.sha256).not.toBe(first.sha256);
  });

  it.each([
    ["HTML error page", () => new Response("<html>Unavailable</html>")],
    ["HTTP failure", () => new Response("Not found", { status: 404 })],
    ["partial response", () => new Response("%PDF-part", { status: 206 })],
    ["oversized response", () => new Response("%PDF-big", { headers: { "content-length": String(26 * 1024 * 1024) } })]
  ])("rejects %s instead of accepting a fingerprint", async (_, response) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response());
    await expect(fetchPdfFingerprint("https://www.kabinet.gov.my/a.pdf", config, fetcher)).rejects.toThrow();
  });

  it("stops downloads that exceed the size limit without a Content-Length", async () => {
    const body = new Uint8Array(26 * 1024 * 1024);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    await expect(fetchPdfFingerprint("https://www.kabinet.gov.my/a.pdf", config, fetcher)).rejects.toThrow("25 MiB");
  });

  it("follows official redirects but never fetches an unapproved redirect host", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/new.pdf" } }))
      .mockResolvedValueOnce(new Response("%PDF-1.7\ncontent"));
    await fetchPdfFingerprint("https://www.kabinet.gov.my/a.pdf", config, fetcher);
    expect(fetcher.mock.calls[1][0]).toBe("https://www.kabinet.gov.my/new.pdf");
    const blocked = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, {
      status: 302, headers: { location: "https://example.org/a.pdf" }
    }));
    await expect(fetchPdfFingerprint("https://www.kabinet.gov.my/a.pdf", config, blocked)).rejects.toThrow("allowed official hosts");
    expect(blocked).toHaveBeenCalledTimes(1);
  });
});
