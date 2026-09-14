import { describe, expect, it } from "vitest";
import { compareSnapshots, extractMeaningfulLinks, snapshotFromHtml, type MonitorConfig } from "../scripts/monitor";

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
});
