import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { articleFromPost, fetchSourceText, officialUrl } from "./rss-monitor.ts";
import type { MonitorConfig, SourceSnapshot } from "./monitor.ts";

type Link = { url: string; title: string; kind?: "article" | "pdf"; publishedDateLabel?: string };
type Evaluation = { choice: string; confidence: number; probabilities: Record<string, number> };
type Entry = {
  sourceId: string; url: string; title: string; kind: string; retrievedAt: string;
  expectedSha256: string | null; currentSha256: string | null; baselineMatches: boolean | null;
  textCharacters: number; textTruncated: boolean; evidenceExcerpt?: string; dateCandidates: string[];
  verdict: "candidate" | "pending" | "not_a_declaration" | "unreadable" | "error";
  answers?: Record<string, Evaluation>; error?: string;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "output", "jev", "evaluation.json");
const maxText = 6000;
const monthPattern = "(?:Januari|Februari|Mac|April|Mei|Jun|Julai|Ogos|September|Oktober|November|Disember|January|February|March|May|June|July|August|October|December)";

function decodeHtml(text: string): string {
  return text.replace(/&#x([a-f0-9]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/gi, " ").replace(/&quot;/gi, '"').replace(/&apos;|&#39;/gi, "'")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

export function plainArticleText(html: string): string {
  return decodeHtml(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function dateCandidates(text: string): string[] {
  const matches = [
    ...text.matchAll(new RegExp(`\\b\\d{1,2}\\s+${monthPattern}\\s+\\d{4}\\b`, "gi")),
    ...text.matchAll(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g),
    ...text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)
  ].map((match) => match[0].replace(/\s+/g, " ").trim());
  return [...new Set(matches)].slice(0, 20);
}

function sha256(data: Uint8Array | string): string { return createHash("sha256").update(data).digest("hex"); }

async function fetchPdf(url: string, config: MonitorConfig): Promise<Uint8Array> {
  const signal = AbortSignal.timeout(20_000);
  let target = url;
  for (let redirects = 0; redirects <= 5; redirects++) {
    target = officialUrl(target, config);
    const response = await fetch(target, { signal, redirect: "manual", headers: { "user-agent": "MalaysiaPublicHolidayAPI-Jev-Evaluation/0.1" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location) throw new Error("PDF redirect missing location");
      target = new URL(location, target).toString();
      continue;
    }
    if (!response.ok || response.status === 206 || !response.body) throw new Error(`PDF HTTP ${response.status}`);
    if (Number(response.headers.get("content-length")) > 25 * 1024 * 1024) throw new Error("PDF exceeds 25 MiB");
    const chunks: Uint8Array[] = []; let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      if (bytes > 25 * 1024 * 1024) throw new Error("PDF exceeds 25 MiB");
      chunks.push(chunk);
    }
    const data = Buffer.concat(chunks);
    if (!data.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw new Error("Source is not a PDF");
    return new Uint8Array(data);
  }
  throw new Error("Too many PDF redirects");
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const loadingTask = getDocument({ data: bytes, useSystemFonts: true, isEvalSupported: false });
  const document = await loadingTask.promise;
  try {
    const pages: string[] = [];
    for (let page = 1; page <= document.numPages; page++) {
      const content = await (await document.getPage(page)).getTextContent();
      pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
    }
    return pages.join("\n").replace(/\s+/g, " ").trim();
  } finally { await loadingTask.destroy(); }
}

async function articleEvidence(link: Link, config: MonitorConfig): Promise<{ text: string; bodyCharacters: number; hash: string }> {
  const snapshotId = new URL(link.url).pathname.match(/\/archives\/(\d+)\/?$/)?.[1];
  const archiveRoot = config.rss?.archiveUrl;
  if (!archiveRoot) throw new Error("Article source lacks an archive endpoint");
  // Johor uses numeric archive permalinks; Kedah uses dated slugs.
  const queryUrl = snapshotId ? `${archiveRoot}/${snapshotId}?_fields=id,link,date_gmt,modified_gmt,title,content`
    : `${archiveRoot}?slug=${encodeURIComponent(new URL(link.url).pathname.split("/").filter(Boolean).at(-1) ?? "")}&_fields=id,link,date_gmt,modified_gmt,title,content`;
  const response = await fetchSourceText(queryUrl, config);
  const parsed: unknown = JSON.parse(response.body);
  const post = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!post) throw new Error("Archive post not found");
  const normalized = articleFromPost(post, config);
  if (normalized.url !== link.url) throw new Error("Archive URL does not match candidate permalink");
  const raw = post as { content: { rendered: string } };
  const body = plainArticleText(raw.content.rendered);
  return { text: `${link.title}. ${body}`, bodyCharacters: body.length, hash: normalized.article.sha256 };
}

export function questionsForDates(dates: string[]) {
  const choices = Object.fromEntries(dates.map((date, i) => [`date_${i + 1}`, `The notice explicitly declares ${date} as an effective holiday date, rather than merely a publication, event, or reference date.`]));
  return {
    declaration: { type: "choice", instructions: "What does the official evidence currently establish about a public holiday? Consider negation and conditions. Do not assume a team won or that a proposal became law.", criteria: {
      declared: "An actual holiday declaration or official schedule is stated.", conditional: "A holiday is proposed, being considered, or depends on an unconfirmed event.",
      denied_or_cancelled: "A holiday claim is denied or an earlier declaration is cancelled.", mention_only: "Holiday words appear incidentally, without declaring a holiday.", unclear: "Insufficient readable evidence to decide."
    } },
    effective_date: { type: "choice", instructions: "Which candidate is explicitly the effective holiday date? Distinguish it from the article's publication date, event date, and unrelated dates. If no candidate is clearly supported, choose no_clear_date.", criteria: { ...choices, no_clear_date: "None of the supplied candidates is clearly an effective holiday date." } },
    jurisdiction: { type: "choice", instructions: "Which geographic jurisdiction does the evidence explicitly say the holiday applies to? A government website's location alone is not proof of scope.", criteria: {
      johor: "Johor statewide", kedah: "Kedah statewide", perlis: "Perlis statewide", other_or_multiple: "Another jurisdiction or multiple jurisdictions", unclear: "No explicit geographic scope"
    } },
    coverage: { type: "choice", instructions: "What population is explicitly covered by the holiday announcement?", criteria: {
      general: "General public holiday for the named jurisdiction", limited: "Only a specified school, agency, employer, group, or locality", unclear: "Coverage is not explicit"
    } }
  } as const;
}

async function askJev(text: string, dates: string[], publicationDate: string | undefined, sourceId: string): Promise<Record<string, Evaluation>> {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) throw new Error("TYPESAFE_API_KEY is not available in this process");
  const questions = questionsForDates(dates);
  const body = JSON.stringify({ model: "jev-latest", state: { sourceId, publicationDate: publicationDate ?? null, evidence: text, dateCandidates: dates }, questions });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch("https://api.typesafe.ai/v1/systemone", {
        method: "POST", signal: AbortSignal.timeout(60_000),
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body
      });
      if (response.ok) return (await response.json() as { answers: Record<string, Evaluation> }).answers;
      if (![429, 503, 529].includes(response.status) || attempt === 2) throw new Error(`Jev HTTP ${response.status}`);
    } catch (error) {
      if (attempt === 2 || !(error instanceof TypeError)) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
  }
  throw new Error("Jev retry limit reached");
}

export function decide(answers: Record<string, Evaluation>, dates: string[], sourceId: string): Entry["verdict"] {
  const declaration = answers.declaration?.choice;
  if (["conditional", "denied_or_cancelled", "mention_only"].includes(declaration)) return "not_a_declaration";
  if (declaration !== "declared") return "pending";
  const date = answers.effective_date?.choice;
  const jurisdiction = answers.jurisdiction?.choice;
  if (!date || date === "no_clear_date" || !/^date_\d+$/.test(date) || !dates[Number(date.slice(5)) - 1]) return "pending";
  if (jurisdiction !== sourceId.split("-")[0] || answers.coverage?.choice !== "general") return "pending";
  if (["declaration", "effective_date", "jurisdiction", "coverage"].some((key) => (answers[key]?.confidence ?? 0) < 0.8)) return "pending";
  return "candidate"; // Candidate for evaluation only; never a publication decision.
}

async function run(): Promise<void> {
  if (!process.env.TYPESAFE_API_KEY) throw new Error("TYPESAFE_API_KEY is not available in this process. Start a new terminal after setting the User environment variable.");
  const configs = JSON.parse(await readFile(path.join(root, "data", "monitor", "config.json"), "utf8")) as MonitorConfig[];
  const baseline = JSON.parse(await readFile(path.join(root, "data", "monitor", "baseline.json"), "utf8")) as { sources: Record<string, SourceSnapshot> };
  let previous: { entries?: Entry[]; promptVersion?: number } = {};
  try { previous = JSON.parse(await readFile(outputPath, "utf8")) as typeof previous; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const previousByUrl = new Map((previous.entries ?? []).map((entry) => [entry.url, entry]));
  const entries: Entry[] = [];
  for (const config of configs.filter((item) => ["johor-announcements", "kedah-announcements", "perlis-media-statements"].includes(item.id))) {
    const snapshot = baseline.sources[config.id];
    for (const link of snapshot?.links ?? []) {
      const entry: Entry = { sourceId: config.id, url: link.url, title: link.title, kind: link.kind ?? "pdf",
        retrievedAt: new Date().toISOString(), expectedSha256: snapshot.articles?.[link.url]?.sha256 ?? snapshot.documents?.[link.url]?.sha256 ?? null,
        currentSha256: null, baselineMatches: null, textCharacters: 0, textTruncated: false, dateCandidates: [], verdict: "error" };
      entries.push(entry);
      try {
        let evidence: { text: string; bodyCharacters: number; hash: string };
        if (link.kind === "article") evidence = await articleEvidence(link, config);
        else {
          const bytes = await fetchPdf(link.url, config);
          const hash = sha256(bytes); // PDF.js transfers the underlying buffer during extraction.
          const body = await pdfText(bytes);
          evidence = { text: `${link.title}. ${body}`, bodyCharacters: body.length, hash };
        }
        entry.currentSha256 = evidence.hash;
        entry.baselineMatches = entry.expectedSha256 === evidence.hash;
        entry.textCharacters = evidence.text.length;
        if (evidence.bodyCharacters < 80) { entry.verdict = "unreadable"; continue; }
        entry.textTruncated = evidence.text.length > maxText;
        const excerpt = evidence.text.slice(0, maxText);
        entry.evidenceExcerpt = excerpt;
        entry.dateCandidates = dateCandidates(excerpt);
        const prior = previousByUrl.get(link.url);
        entry.answers = prior?.evidenceExcerpt === excerpt && prior.expectedSha256 === entry.expectedSha256 &&
          entry.baselineMatches && (previous.promptVersion ?? 1) === 1 && prior.answers
          ? prior.answers
          : await askJev(excerpt, entry.dateCandidates, link.publishedDateLabel, config.id);
        entry.verdict = entry.baselineMatches ? decide(entry.answers, entry.dateCandidates, config.id) : "pending";
      } catch (error) { entry.error = error instanceof Error ? error.message : String(error); }
      console.log(`${config.id}: ${link.title}: ${entry.verdict}${entry.error ? ` (${entry.error})` : ""}`);
    }
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  const report = { generatedAt: new Date().toISOString(), mode: "shadow evaluation; no holiday records changed", model: "jev-latest", promptVersion: 1, entries };
  await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`Saved ${entries.length} evaluations to ${outputPath}`);
  if (entries.some((entry) => entry.verdict === "error")) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await run();
