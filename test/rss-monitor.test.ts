import { describe, expect, it, vi } from "vitest";
import { articleFromPost, collectRssSnapshot, fetchSourceText, parseFeed } from "../scripts/rss-monitor";
import { compareSnapshots, type MonitorConfig } from "../scripts/monitor";

const config: MonitorConfig = {
  id: "rss", name: "Official feed", url: "https://official.test/feed", allowedHosts: ["official.test"],
  trustTier: 2, minimumLinks: 0, includeUrlPattern: "pdf",
  rss: { archiveUrl: "https://official.test/wp-json/wp/v2/posts", includeTextPattern: "cuti|public holiday", maxArchivePages: 10, minimumArchivePosts: 1 }
};
const post = (id: number, body = "ordinary news") => ({ id, link: `https://official.test/${id}`,
  title: { rendered: `Notice ${id}` }, content: { rendered: body }, date_gmt: "2026-01-01T00:00:00", modified_gmt: "2026-01-01T00:00:00" });
const feed = (id = 2) => `<rss><channel><item><guid>id-${id}</guid><link>https://official.test/${id}</link><description><![CDATA[<p>News & text</p>]]></description></item></channel></rss>`;
const pdf = vi.fn(async () => ({ sha256: "pdf-hash", bytes: 100 }));
function fetcher(posts = [post(1, "cuti peristiwa"), post(2)], pages = 1, total = posts.length): typeof fetch {
  return vi.fn<typeof fetch>(async (url) => String(url) === config.url ? new Response(feed()) :
    new Response(JSON.stringify(pages === 1 ? posts : [posts[Number(new URL(String(url)).searchParams.get("page")) - 1]]), {
      headers: { "x-wp-total": String(total), "x-wp-totalpages": String(pages) }
    }));
}
const collect = (posts?: ReturnType<typeof post>[]) => collectRssSnapshot(config, "now", pdf, fetcher(posts));

describe("RSS archive reconciliation", () => {
  it("reads XML with CDATA and retains stable identities", () => {
    expect(parseFeed(feed(), config)).toEqual([{ url: "https://official.test/2", guid: "id-2" }]);
  });
  it.each(["<html>error</html>", "<rss>", '<!DOCTYPE rss><rss/>', feed().replace("official.test/2", "evil.test/2"),
    feed().replace("</channel>", "<item><guid>id-2</guid><link>https://official.test/3</link></item></channel>")])("rejects invalid or unsafe feeds", (xml) => {
    expect(() => parseFeed(xml, config)).toThrow();
  });
  it("finds old candidates outside the RSS window across archive pages", async () => {
    const snapshot = await collectRssSnapshot(config, "now", pdf, fetcher(undefined, 2));
    expect(snapshot.archivePostCount).toBe(2);
    expect(snapshot.links.map(l => l.url)).toEqual(["https://official.test/1"]);
  });
  it("detects old article edits, relevance changes and removals", async () => {
    const first = await collect();
    const changed = await collect([post(1, "cuti cancelled"), post(2)]);
    expect(compareSnapshots(config, first, changed)?.contentChanged).toHaveLength(1);
    const removed = await collect([post(2)]);
    expect(compareSnapshots(config, first, removed)?.removed).toHaveLength(1);
    const irrelevant = await collect([post(1), post(2)]);
    expect(compareSnapshots(config, first, irrelevant)?.removed).toHaveLength(1);
  });
  it("ignores markup-only edits and unrelated new articles", async () => {
    const first = await collect();
    const next = await collect([post(1, "<p>cuti peristiwa</p>"), post(2), post(3)]);
    expect(compareSnapshots(config, first, next)).toBeNull();
  });
  it("fingerprints embedded official PDFs and reports unapproved attachments", async () => {
    const body = 'cuti <iframe src="/?url=https%3A%2F%2Fofficial.test%2Fnotice.pdf"></iframe><a href="https://other.test/evidence.pdf">Evidence</a>';
    const first = await collect([post(1, body), post(2)]);
    expect(first.documents).toEqual({ "https://official.test/notice.pdf": { sha256: "pdf-hash", bytes: 100 } });
    expect(first.articles!["https://official.test/1"].unverifiedPdfUrls).toEqual(["https://other.test/evidence.pdf"]);
    const next = { ...first, documents: { "https://official.test/notice.pdf": { sha256: "changed", bytes: 100 } } };
    expect(compareSnapshots(config, first, next)?.contentChanged).toHaveLength(1);
  });
  it.each([
    ["archive bounds", () => fetcher(undefined, 11)],
    ["incomplete archive", () => fetcher(undefined, 1, 3)],
    ["duplicate posts", () => fetcher([post(2), post(2)])],
    ["RSS missing from archive", () => fetcher([post(1)])],
    ["missing headers", () => vi.fn<typeof fetch>(async url => new Response(String(url) === config.url ? feed() : "[]"))]
  ])("fails visibly on %s", async (_, makeFetch) => {
    await expect(collectRssSnapshot(config, "now", pdf, makeFetch())).rejects.toThrow();
  });
  it("does not return a successful snapshot when a candidate PDF fails", async () => {
    await expect(collectRssSnapshot(config, "now", async () => { throw new Error("PDF failed"); },
      fetcher([post(1, 'cuti <a href="/notice.pdf">PDF</a>'), post(2)]))).rejects.toThrow("PDF failed");
  });
  it("blocks unapproved redirects before requesting the new host", async () => {
    const request = vi.fn<typeof fetch>(async () => new Response(null, { status: 302, headers: { location: "https://evil.test/" } }));
    await expect(fetchSourceText(config.url, config, request)).rejects.toThrow("Unapproved");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("rejects invalid archive dates", () => {
    expect(() => articleFromPost({ ...post(1), modified_gmt: "unknown" }, config)).toThrow();
  });
});
