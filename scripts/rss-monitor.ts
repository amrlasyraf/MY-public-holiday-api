import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { MonitorConfig, MonitoredLink, SourceSnapshot } from "./monitor";

export type ArticleFingerprint = {
  id: number;
  title: string;
  publishedAt: string;
  modifiedAt: string;
  sha256: string;
  relevant: boolean;
  pdfUrls: string[];
  unverifiedPdfUrls: string[];
};

function decode(value: string): string {
  return value.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

function text(html: string): string {
  return decode(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeUrl(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

export function officialUrl(value: string, config: MonitorConfig): string {
  const url = new URL(value, config.url);
  if (url.protocol !== "https:" || url.username || url.password || !config.allowedHosts.includes(url.hostname)) {
    throw new Error(`Unapproved source URL: ${url.origin}`);
  }
  url.hash = "";
  return url.toString();
}

// Bounds cover the complete response body, not only connection establishment.
export async function fetchSourceText(url: string, config: MonitorConfig, fetcher: typeof fetch = fetch): Promise<{
  body: string; headers: Headers;
}> {
  const signal = AbortSignal.timeout(20_000);
  let target = url;
  for (let redirects = 0; redirects <= 5; redirects++) {
    target = officialUrl(target, config);
    const response = await fetcher(target, {
      signal, redirect: "manual", headers: { "user-agent": "MalaysiaPublicHolidayAPI-Monitor/0.3", "cache-control": "no-cache" }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect missing location");
      target = new URL(location, target).toString();
      continue;
    }
    if (!response.ok || response.status === 206 || !response.body) {
      await response.body?.cancel();
      throw new Error(`Source HTTP ${response.status}`);
    }
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 8 * 1024 * 1024) throw new Error("Source response exceeds 8 MiB");
        chunks.push(chunk.value);
      }
      return { body: Buffer.concat(chunks).toString("utf8"), headers: response.headers };
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
  }
  throw new Error("Too many source redirects");
}

export function parseFeed(xml: string, config: MonitorConfig): { url: string; guid: string }[] {
  // Neither external entities nor custom entity declarations are needed for these RSS feeds.
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error("Invalid or unsupported RSS XML");
  const parsed = new XMLParser({ parseTagValue: false, processEntities: false, ignoreAttributes: true }).parse(xml);
  const items = parsed?.rss?.channel?.item;
  if (!items) throw new Error("RSS feed has no items");
  const result = (Array.isArray(items) ? items : [items]).map((item) => {
    if (typeof item.link !== "string" || typeof item.guid !== "string") throw new Error("RSS item lacks link or identity");
    return { url: officialUrl(decode(item.link.trim()), config), guid: decode(item.guid.trim()) };
  });
  if (new Set(result.map((item) => item.guid)).size !== result.length) throw new Error("Duplicate RSS identities");
  return result;
}

export function articleFromPost(post: unknown, config: MonitorConfig): { url: string; article: ArticleFingerprint } {
  const p = post as { id: number; link: string; date_gmt: string; modified_gmt: string;
    title: { rendered: string }; content: { rendered: string } };
  if (!p || !Number.isSafeInteger(p.id) || p.id <= 0 || typeof p.link !== "string" ||
      typeof p.title?.rendered !== "string" || typeof p.content?.rendered !== "string") throw new Error("Invalid archive post");
  const asUtc = (date: string) => {
    if (typeof date !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(date) || !Number.isFinite(Date.parse(date + "Z"))) {
      throw new Error("Invalid archive publication/modification date");
    }
    return date + "Z";
  };
  const url = officialUrl(p.link, config);
  const title = text(p.title.rendered);
  const body = text(p.content.rendered);
  const references = new Set<string>();
  for (const match of p.content.rendered.matchAll(/\b(?:href|src|url|data-url)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    try {
      const ref = new URL(decode(match[1] ?? match[2]), url);
      if (!["https:", "http:"].includes(ref.protocol)) continue;
      ref.hash = "";
      references.add(ref.toString());
      // Johor's PDF viewer stores the actual document URL in its query string.
      const embedded = ref.searchParams.get("url");
      if (embedded) references.add(new URL(embedded, url).toString());
    } catch { /* Ignore non-URL presentation attributes. */ }
  }
  const urls = [...references].sort();
  const pdfUrls: string[] = [], unverifiedPdfUrls: string[] = [];
  for (const reference of urls.filter((ref) => /\.pdf$/i.test(new URL(ref).pathname))) {
    try { pdfUrls.push(officialUrl(reference, config)); }
    catch { unverifiedPdfUrls.push(reference); }
  }
  const relevant = new RegExp(config.rss!.includeTextPattern, "i").test(title + " " + body + " " + urls.map(decodeUrl).join(" "));
  // Ignore theme chrome, counters and markup-only edits; retain article text and resource URLs.
  const sha256 = createHash("sha256").update(JSON.stringify({ title, body, urls })).digest("hex");
  return { url, article: { id: p.id, title, publishedAt: asUtc(p.date_gmt), modifiedAt: asUtc(p.modified_gmt),
    sha256, relevant, pdfUrls: [...new Set(pdfUrls)].sort(), unverifiedPdfUrls } };
}

export async function collectRssSnapshot(
  config: MonitorConfig,
  checkedAt: string,
  fingerprintPdf: (url: string, config: MonitorConfig) => Promise<{ sha256: string; bytes: number }>,
  fetcher: typeof fetch = fetch
): Promise<SourceSnapshot> {
  const options = config.rss;
  if (!options) throw new Error("Missing RSS configuration");
  const feed = parseFeed((await fetchSourceText(config.url, config, fetcher)).body, config);
  const articles: Record<string, ArticleFingerprint> = {};
  const ids = new Set<number>();
  let total = -1, pageCount = -1;
  for (let page = 1; page <= options.maxArchivePages; page++) {
    const url = new URL(options.archiveUrl);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("orderby", "id");
    url.searchParams.set("order", "asc");
    url.searchParams.set("_fields", "id,link,date_gmt,modified_gmt,title,content");
    const response = await fetchSourceText(url.toString(), config, fetcher);
    const countHeader = response.headers.get("x-wp-total"), pagesHeader = response.headers.get("x-wp-totalpages");
    if (!countHeader || !pagesHeader || !/^\d+$/.test(countHeader) || !/^\d+$/.test(pagesHeader)) throw new Error("Archive pagination headers missing or invalid");
    const count = Number(countHeader), pages = Number(pagesHeader);
    if (count < options.minimumArchivePosts || pages < 1 || pages > options.maxArchivePages) throw new Error("Archive size outside configured bounds; reconciliation incomplete");
    if (total !== -1 && (count !== total || pages !== pageCount)) throw new Error("Archive changed during pagination; retry reconciliation");
    total = count; pageCount = pages;
    const posts: unknown = JSON.parse(response.body);
    if (!Array.isArray(posts) || !posts.length || posts.length > 100) throw new Error("Invalid archive page");
    for (const post of posts) {
      const { url: articleUrl, article } = articleFromPost(post, config);
      if (articles[articleUrl] || ids.has(article.id)) throw new Error("Duplicate archive post; pagination may be broken");
      ids.add(article.id);
      articles[articleUrl] = article;
    }
    if (page === pages) break;
  }
  if (Object.keys(articles).length !== total) throw new Error("Incomplete archive reconciliation");
  if (feed.some((item) => !articles[item.url])) throw new Error("RSS article missing from archive; retry reconciliation");
  const links = new Map<string, MonitoredLink>();
  const documents: NonNullable<SourceSnapshot["documents"]> = {};
  for (const [url, article] of Object.entries(articles).sort(([a], [b]) => a.localeCompare(b))) {
    if (!article.relevant) continue;
    links.set(url, { url, title: article.title, publishedDateLabel: article.publishedAt, kind: "article" });
    for (const pdfUrl of article.pdfUrls) {
      if (!documents[pdfUrl]) documents[pdfUrl] = await fingerprintPdf(pdfUrl, config);
      links.set(pdfUrl, { url: pdfUrl, title: `PDF: ${decodeUrl(new URL(pdfUrl).pathname.split("/").at(-1)!)}`, kind: "pdf" });
    }
  }
  const selected = [...links.values()].sort((a, b) => a.url.localeCompare(b.url));
  return {
    sourceId: config.id, sourceUrl: config.url, checkedAt,
    hash: createHash("sha256").update(JSON.stringify(selected)).digest("hex"),
    links: selected, articles, documents, feedItemCount: feed.length, archivePostCount: total,
    feedItems: feed
  };
}
