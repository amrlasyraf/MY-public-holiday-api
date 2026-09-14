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
};

export type MonitoredLink = { title: string; url: string };
export type SourceSnapshot = {
  sourceId: string;
  sourceUrl: string;
  checkedAt: string;
  hash: string;
  links: MonitoredLink[];
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

function cleanTitle(html: string, fallbackUrl: string): string {
  const text = decodeHtml(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
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
  const links = extractMeaningfulLinks(html, config);
  const hash = createHash("sha256").update(JSON.stringify(links)).digest("hex");
  return { sourceId: config.id, sourceUrl: config.url, checkedAt, hash, links };
}

export function compareSnapshots(
  config: MonitorConfig,
  previous: SourceSnapshot | undefined,
  current: SourceSnapshot
): SourceChange | null {
  if (previous?.hash === current.hash) return null;
  const previousByUrl = new Map((previous?.links ?? []).map((link) => [link.url, link]));
  const currentByUrl = new Map(current.links.map((link) => [link.url, link]));
  const added = current.links.filter((link) => {
    const old = previousByUrl.get(link.url);
    return !old || old.title !== link.title;
  });
  const removed = (previous?.links ?? []).filter((link) => {
    const next = currentByUrl.get(link.url);
    return !next || next.title !== link.title;
  });
  return {
    sourceId: config.id,
    sourceName: config.name,
    sourceUrl: config.url,
    previousHash: previous?.hash ?? null,
    currentHash: current.hash,
    added,
    removed
  };
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
    lines.push(...(change.added.length ? change.added.map((link) => `- [${link.title}](${link.url})`) : ["- None"]));
    lines.push("", "### Removed or retitled links", "");
    lines.push(...(change.removed.length ? change.removed.map((link) => `- [${link.title}](${link.url})`) : ["- None"]));
    lines.push("");
  }
  if (errors.length) lines.push("## Errors", "", ...errors.map((error) => `- ${error}`), "");
  return `${lines.join("\n")}\n`;
}

async function run(): Promise<void> {
  const updateBaseline = process.argv.includes("--update-baseline");
  const configs = JSON.parse(await readFile(configPath, "utf8")) as MonitorConfig[];
  let baseline: Baseline = { version: 1, updatedAt: "", sources: {} };
  try {
    baseline = JSON.parse(await readFile(baselinePath, "utf8")) as Baseline;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const checkedAt = new Date().toISOString();
  const currentSources: Record<string, SourceSnapshot> = {};
  const changes: SourceChange[] = [];
  const errors: string[] = [];

  for (const config of configs) {
    try {
      const snapshot = snapshotFromHtml(config, await fetchHtml(config), checkedAt);
      if (snapshot.links.length < config.minimumLinks) {
        throw new Error(`Expected at least ${config.minimumLinks} official links, found ${snapshot.links.length}`);
      }
      currentSources[config.id] = snapshot;
      const change = compareSnapshots(config, baseline.sources[config.id], snapshot);
      if (change) changes.push(change);
    } catch (error) {
      errors.push(`${config.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const signature = createHash("sha256")
    .update(JSON.stringify(changes.map(({ sourceId, currentHash }) => ({ sourceId, currentHash }))))
    .digest("hex")
    .slice(0, 16);

  await mkdir(outputDirectory, { recursive: true });
  const report = { version: 1, checkedAt, signature, changed: changes.length > 0, changes, errors };
  await writeFile(path.join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputDirectory, "report.md"), markdownReport(checkedAt, signature, changes, errors), "utf8");

  if (errors.length) {
    console.error(`Monitor failed for ${errors.length} source(s). See output/monitor/report.md.`);
    process.exitCode = 1;
    return;
  }

  if (updateBaseline) {
    const nextBaseline: Baseline = { version: 1, updatedAt: checkedAt, sources: currentSources };
    await writeFile(baselinePath, `${JSON.stringify(nextBaseline, null, 2)}\n`, "utf8");
    console.log(`Updated baseline for ${Object.keys(currentSources).length} sources.`);
    return;
  }

  if (changes.length) {
    console.log(`Detected ${changes.length} changed source(s); signature ${signature}.`);
    process.exitCode = 2;
  } else {
    console.log(`No meaningful changes across ${configs.length} official sources.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run();
}
