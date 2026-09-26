import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type MonitorConfig = {
  id: string;
  name: string;
  url: string;
  allowedHosts: string[];
  includeUrlPattern: string;
  minimumLinks: number;
  trustTier: number;
  tableRows?: {
    titleCell: number;
    dateCell: number;
    includeTextPattern: string;
    minimumDocumentLinks: number;
  };
};

export type MonitoredLink = { title: string; url: string; publishedDateLabel?: string };
type DocumentFingerprint = { sha256: string; bytes: number };
export type SourceSnapshot = {
  sourceId: string;
  sourceUrl: string;
  checkedAt: string;
  hash: string;
  links: MonitoredLink[];
  documents?: Record<string, DocumentFingerprint>;
  indexDocumentCount?: number;
};

type Baseline = {
  version: 1;
  updatedAt: string;
  sources: Record<string, SourceSnapshot>;
};

type SourceChange = {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  previousHash: string | null;
  currentHash: string;
  added: MonitoredLink[];
  removed: MonitoredLink[];
  contentChanged: { url: string; title: string; previousSha256: string; currentSha256: string }[];
};

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const configPath = path.join(rootDirectory, "data", "monitor", "config.json");
const baselinePath = path.join(rootDirectory, "data", "monitor", "baseline.json");
const outputDirectory = path.join(rootDirectory, "output", "monitor");

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function plainText(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function cleanTitle(html: string, fallbackUrl: string): string {
  const text = plainText(html);
  if (text) return text;
  const pathname = new URL(fallbackUrl).pathname;
  return decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) ?? fallbackUrl);
}

export function extractMeaningfulLinks(html: string, config: MonitorConfig): MonitoredLink[] {
  const include = new RegExp(config.includeUrlPattern, "i");
  const links = new Map<string, MonitoredLink>();
  const anchorPattern = /<a\b[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    const rawHref = decodeHtml(match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("javascript:")) continue;

    let resolved: URL;
    try {
      resolved = new URL(rawHref, config.url);
    } catch {
      continue;
    }

    if (resolved.protocol !== "https:" || !config.allowedHosts.includes(resolved.hostname)) continue;
    resolved.hash = "";
    for (const key of [...resolved.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_")) resolved.searchParams.delete(key);
    }
    const url = resolved.toString();
    if (!include.test(url)) continue;
    links.set(url, { url, title: cleanTitle(match[4], url) });
  }

  return [...links.values()].sort((a, b) => a.url.localeCompare(b.url));
}

export function snapshotFromHtml(config: MonitorConfig, html: string, checkedAt: string): SourceSnapshot {
  const table = config.tableRows ? extractTableCandidates(html, config) : undefined;
  const links = table?.links ?? extractMeaningfulLinks(html, config);
  const hash = createHash("sha256").update(JSON.stringify(links)).digest("hex");
  return { sourceId: config.id, sourceUrl: config.url, checkedAt, hash, links,
    ...(table ? { indexDocumentCount: table.indexDocumentCount } : {}) };
}

export function extractTableCandidates(html: string, config: MonitorConfig): {
  links: MonitoredLink[]; indexDocumentCount: number;
} {
  const options = config.tableRows;
  if (!options) throw new Error("Table extraction requires tableRows configuration");
  const includeText = new RegExp(options.includeTextPattern, "i");
  const discovered = new Set<string>();
  const candidates = new Map<string, MonitoredLink>();
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
    const titleCell = cells[options.titleCell];
    const dateCell = cells[options.dateCell];
    if (titleCell === undefined || dateCell === undefined) continue;
    for (const link of extractMeaningfulLinks(titleCell, config)) {
      discovered.add(link.url);
      const title = cleanTitle(titleCell, link.url);
      // The publication date is context, not the holiday's effective date.
      const publishedDateLabel = plainText(dateCell);
      if (!includeText.test(title + " " + decodeURIComponent(link.url))) continue;
      candidates.set(link.url, { ...link, title, ...(publishedDateLabel ? { publishedDateLabel } : {}) });
    }
  }
  if (discovered.size < options.minimumDocumentLinks) {
    throw new Error(`Expected at least ${options.minimumDocumentLinks} official document links in table rows, found ${discovered.size}`);
  }
  return { links: [...candidates.values()].sort((a, b) => a.url.localeCompare(b.url)), indexDocumentCount: discovered.size };
}

export function compareSnapshots(
  config: MonitorConfig,
  previous: SourceSnapshot | undefined,
  current: SourceSnapshot
): SourceChange | null {
  const previousByUrl = new Map((previous?.links ?? []).map((link) => [link.url, link]));
  const currentByUrl = new Map(current.links.map((link) => [link.url, link]));
  const added = current.links.filter((link) => {
    const old = previousByUrl.get(link.url);
    return !old || old.title !== link.title || old.publishedDateLabel !== link.publishedDateLabel;
  });
  const removed = (previous?.links ?? []).filter((link) => {
    const next = currentByUrl.get(link.url);
    return !next || next.title !== link.title || next.publishedDateLabel !== link.publishedDateLabel;
  });
  const contentChanged = current.links.flatMap((link) => {
    const old = previous?.documents?.[link.url];
    const next = current.documents?.[link.url];
    return old && next && old.sha256 !== next.sha256
      ? [{ ...link, previousSha256: old.sha256, currentSha256: next.sha256 }]
      : [];
  });
  if (previous?.hash === current.hash && !contentChanged.length) return null;
  return {
    sourceId: config.id,
    sourceName: config.name,
    sourceUrl: config.url,
    previousHash: previous?.hash ?? null,
    currentHash: current.hash,
    added,
    removed,
    contentChanged
  };
}

// Hash the actual bytes on every run; HTTP validators alone can miss replacements.
export async function fetchPdfFingerprint(
  url: string, config: MonitorConfig, fetcher: typeof fetch = fetch
): Promise<DocumentFingerprint> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const maxBytes = 25 * 1024 * 1024;
  try {
    let target = url;
    for (let redirects = 0; redirects <= 5; redirects++) {
      const parsed = new URL(target);
      if (parsed.protocol !== "https:" || !config.allowedHosts.includes(parsed.hostname)) {
        throw new Error("PDF URL or redirect is outside the allowed official hosts");
      }
      const response = await fetcher(target, {
        headers: { "user-agent": "MalaysiaPublicHolidayAPI-Monitor/0.2", "cache-control": "no-cache" },
        redirect: "manual", signal: controller.signal
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location) throw new Error("PDF redirect has no location");
        target = new URL(location, target).toString();
        continue;
      }
      if (!response.ok || response.status === 206) {
        await response.body?.cancel();
        throw new Error(`PDF HTTP ${response.status}`);
      }
      if (Number(response.headers.get("content-length")) > maxBytes) {
        await response.body?.cancel();
        throw new Error("PDF exceeds 25 MiB limit");
      }
      if (!response.body) throw new Error("Empty PDF response");
      const reader = response.body.getReader();
      const hash = createHash("sha256");
      let bytes = 0;
      let prefix = Buffer.alloc(0);
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > maxBytes) throw new Error("PDF exceeds 25 MiB limit");
          if (prefix.length < 1024) prefix = Buffer.concat([prefix, value.subarray(0, 1024 - prefix.length)]);
          hash.update(value);
        }
        if (!prefix.includes(Buffer.from("%PDF-"))) throw new Error("Response is not a PDF");
        return { sha256: hash.digest("hex"), bytes };
      } finally {
        await reader.cancel();
        reader.releaseLock();
      }
    }
    throw new Error("Too many PDF redirects");
  } finally {
    clearTimeout(timeout);
  }
}

export function changeSignature(changes: SourceChange[]): string {
  return createHash("sha256")
    .update(JSON.stringify(changes.map(({ sourceId, currentHash, contentChanged }) => ({ sourceId, currentHash, contentChanged }))))
    .digest("hex").slice(0, 16);
}

async function fetchHtml(config: MonitorConfig): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(config.url, {
      headers: { "user-agent": "MalaysiaPublicHolidayAPI-Monitor/0.1 (+open-source; source-checker)" },
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function markdownReport(checkedAt: string, signature: string, changes: SourceChange[], errors: string[]): string {
  const describeLink = (link: MonitoredLink) => `- [${link.title}](${link.url})` +
    (link.publishedDateLabel ? ` (index publication date: ${link.publishedDateLabel})` : "");
  const lines = [
    "# Official holiday source monitor",
    "",
    `Checked: ${checkedAt}`,
    `Change signature: \`${signature}\``,
    "",
    "This is a detection signal. A human must inspect the official document before changing holiday data.",
    ""
  ];
  for (const change of changes) {
    lines.push(`## ${change.sourceName}`, "", `Source: ${change.sourceUrl}`, "");
    lines.push("### Added or changed links", "");
    lines.push(...(change.added.length ? change.added.map(describeLink) : ["- None"]));
    lines.push("", "### Removed links or previous metadata", "");
    lines.push(...(change.removed.length ? change.removed.map(describeLink) : ["- None"]));
    lines.push("", "### Changed PDF content", "");
    lines.push(...(change.contentChanged.length ? change.contentChanged.map((document) =>
      `- [${document.title}](${document.url}): SHA-256 ${document.previousSha256} → ${document.currentSha256}`
    ) : ["- None"]));
    lines.push("");
  }
  if (errors.length) lines.push("## Errors", "", ...errors.map((error) => `- ${error}`), "");
  return `${lines.join("\n")}\n`;
}

async function run(): Promise<void> {
  const updateBaseline = process.argv.includes("--update-baseline");
  const initializeContent = process.argv.includes("--initialize-content-baseline");
  if (updateBaseline && initializeContent) throw new Error("Choose one baseline operation");
  const configs = JSON.parse(await readFile(configPath, "utf8")) as MonitorConfig[];
  let baseline: Baseline = { version: 1, updatedAt: "", sources: {} };
  try {
    baseline = JSON.parse(await readFile(baselinePath, "utf8")) as Baseline;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  // Reuse accepted source checksums when migrating the older link-only baseline.
  const sources = JSON.parse(await readFile(path.join(rootDirectory, "data", "sources.json"), "utf8")) as
    { url: string; checksumAlgorithm?: string; checksum?: string }[];
  for (const snapshot of Object.values(baseline.sources)) {
    snapshot.documents ??= {};
    for (const link of snapshot.links) {
      const source = sources.find((source) => source.url === link.url && source.checksumAlgorithm === "sha256");
      if (!snapshot.documents[link.url] && source?.checksum) {
        snapshot.documents[link.url] = { sha256: source.checksum, bytes: 0 };
      }
    }
  }

  const checkedAt = new Date().toISOString();
  const currentSources: Record<string, SourceSnapshot> = {};
  const changes: SourceChange[] = [];
  const errors: string[] = [];
  const unbaselinedDocuments: string[] = [];
  const downloads = new Map<string, DocumentFingerprint>();

  for (const config of configs) {
    try {
      const snapshot = snapshotFromHtml(config, await fetchHtml(config), checkedAt);
      if (snapshot.links.length < config.minimumLinks) {
        throw new Error(`Expected at least ${config.minimumLinks} official links, found ${snapshot.links.length}`);
      }
      snapshot.documents = {};
      for (const link of snapshot.links) {
        try {
          const fingerprint = downloads.get(link.url) ?? await fetchPdfFingerprint(link.url, config);
          downloads.set(link.url, fingerprint);
          snapshot.documents[link.url] = fingerprint;
          if (!baseline.sources[config.id]?.documents?.[link.url]) unbaselinedDocuments.push(link.url);
        } catch (error) {
          errors.push(`${config.id}: ${link.url}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      currentSources[config.id] = snapshot;
      const change = compareSnapshots(config, baseline.sources[config.id], snapshot);
      if (change) changes.push(change);
    } catch (error) {
      errors.push(`${config.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const signature = changeSignature(changes);

  await mkdir(outputDirectory, { recursive: true });
  const report = { version: 2, checkedAt, signature, changed: changes.length > 0, changes, errors,
    unbaselinedDocuments, sources: currentSources };
  await writeFile(path.join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const initializationNote = unbaselinedDocuments.length
    ? `\n## PDF fingerprints without a previous baseline\n\n${unbaselinedDocuments.map((url) => `- ${url}`).join("\n")}\n\nThese are first observations, not proof that content is unchanged.\n`
    : "";
  await writeFile(path.join(outputDirectory, "report.md"), markdownReport(checkedAt, signature, changes, errors) + initializationNote, "utf8");

  if (errors.length) {
    console.error(`Monitor failed for ${errors.length} source(s). See output/monitor/report.md.`);
    process.exitCode = 1;
    return;
  }

  if (initializeContent && changes.length) {
    console.error("Content baseline initialization refused: existing links or accepted PDF checksums changed. Review the report.");
    process.exitCode = 2;
    return;
  }
  if (updateBaseline || initializeContent) {
    const nextBaseline: Baseline = { version: 1, updatedAt: checkedAt, sources: currentSources };
    await writeFile(baselinePath, `${JSON.stringify(nextBaseline, null, 2)}\n`, "utf8");
    console.log(`Updated baseline for ${Object.keys(currentSources).length} sources.`);
    return;
  }

  if (changes.length) {
    console.log(`Detected ${changes.length} changed source(s); signature ${signature}.`);
    process.exitCode = 2;
  } else if (unbaselinedDocuments.length) {
    console.error("PDF content baseline is incomplete. Run npm run monitor:initialize-content after reviewing the report.");
    process.exitCode = 1;
  } else {
    console.log(`No changes across ${configs.length} official sources and ${downloads.size} PDFs.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run();
}
