import * as cheerio from "cheerio";

export interface PageContext {
  pageTitle?: string;
  reducedHtml: string;
  visibleText: string;
  candidates: CandidateElement[];
  repeatedGroups: RepeatedGroup[];
  structuredData: StructuredDataBlock[];
  stats: {
    originalHtmlLength: number;
    reducedHtmlLength: number;
    visibleTextLength: number;
    candidateCount: number;
    repeatedGroupCount: number;
    structuredDataCount: number;
  };
}

export interface CandidateElement {
  selector: string;
  tag: string;
  text: string;
  attributes: Record<string, string>;
  score: number;
}

export interface StructuredDataBlock {
  kind: "json-ld" | "meta";
  selector: string;
  text: string;
}

export interface RepeatedGroup {
  selector: string;
  count: number;
  sampleTexts: string[];
  sampleAttributes: Array<Record<string, string>>;
  fieldHints: string[];
}

export interface ReducePageOptions {
  maxHtmlChars?: number;
  maxTextChars?: number;
  maxCandidates?: number;
}

const DEFAULT_OPTIONS: Required<ReducePageOptions> = {
  maxHtmlChars: 45000,
  maxTextChars: 12000,
  maxCandidates: 80
};

export function reducePage(html: string, options: ReducePageOptions = {}): PageContext {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const $ = cheerio.load(html);

  $("script:not([type='application/ld+json']), style, svg, canvas, noscript, iframe").remove();
  const pageTitle = $("title").first().text().trim() || undefined;
  const structuredData = collectStructuredData($);
  const candidates = collectCandidates($).slice(0, opts.maxCandidates);
  const repeatedGroups = collectRepeatedGroups($).slice(0, 12);
  const visibleText = normalizeText($("body").text()).slice(0, opts.maxTextChars);
  const reducedHtml = buildReducedHtml($, opts.maxHtmlChars);

  return {
    pageTitle,
    reducedHtml,
    visibleText,
    candidates,
    repeatedGroups,
    structuredData,
    stats: {
      originalHtmlLength: html.length,
      reducedHtmlLength: reducedHtml.length,
      visibleTextLength: visibleText.length,
      candidateCount: candidates.length,
      repeatedGroupCount: repeatedGroups.length,
      structuredDataCount: structuredData.length
    }
  };
}

function collectRepeatedGroups($: cheerio.CheerioAPI): RepeatedGroup[] {
  const groups = new Map<string, any[]>();
  const selector = "a[class], article[class], li[class], tr[class], div[class], section[class]";

  $(selector).each((_, element) => {
    const text = normalizeText($(element).text());
    if (text.length < 20 || text.length > 1200) return;
    const attrs = pickAttributes($, element);
    const classSelector = stableClassSelector(getTagName(element), attrs.class);
    if (!classSelector) return;
    const existing = groups.get(classSelector) ?? [];
    existing.push(element);
    groups.set(classSelector, existing);
  });

  return Array.from(groups.entries())
    .map(([selector, elements]) => {
      const sample = elements.slice(0, 5);
      return {
        selector,
        count: elements.length,
        sampleTexts: sample.map((element) => normalizeText($(element).text()).slice(0, 500)),
        sampleAttributes: sample.map((element) => pickAttributes($, element)),
        fieldHints: inferFieldHints($, sample)
      };
    })
    .filter((group) => group.count >= 3)
    .sort((a, b) => repeatedGroupScore(b) - repeatedGroupScore(a));
}

function stableClassSelector(tag: string, className?: string): string | undefined {
  if (!className) return undefined;
  const classes = className
    .split(/\s+/)
    .filter((name) => name && !/[0-9]{4,}|__[a-z0-9]{4,}|css-|sc-/i.test(name))
    .slice(0, 1);
  if (classes.length === 0) return undefined;
  return `${tag}.${classes.map(cssEscape).join(".")}`;
}

function repeatedGroupScore(group: RepeatedGroup): number {
  let score = Math.min(group.count, 1000);
  if (group.fieldHints.length >= 2) score += 200;
  if (group.sampleAttributes.some((attrs) => attrs.href)) score += 150;
  if (group.sampleTexts.some((text) => text.length > 40 && text.length < 400)) score += 100;
  return score;
}

function inferFieldHints($: cheerio.CheerioAPI, elements: any[]): string[] {
  const hints = new Set<string>();
  for (const element of elements) {
    $(element)
      .find("[class], [itemprop], [data-testid], [data-test], [href]")
      .each((_, child) => {
        const attrs = pickAttributes($, child);
        const joined = `${getTagName(child)} ${Object.values(attrs).join(" ")}`.toLowerCase();
        if (/price|amount|cost/.test(joined)) hints.add(bestSelector($, child, attrs));
        if (/title|name|desc|description/.test(joined)) hints.add(bestSelector($, child, attrs));
        if (/seller|user|author|vendor/.test(joined)) hints.add(bestSelector($, child, attrs));
        if (/date|time/.test(joined)) hints.add(bestSelector($, child, attrs));
        if (/rating|score|review/.test(joined)) hints.add(bestSelector($, child, attrs));
        if (attrs.href) hints.add(bestSelector($, child, attrs));
      });
  }
  return Array.from(hints).slice(0, 12);
}

function collectStructuredData($: cheerio.CheerioAPI): StructuredDataBlock[] {
  const blocks: StructuredDataBlock[] = [];

  $("script[type='application/ld+json']").each((index, element) => {
    const text = normalizeText($(element).text());
    if (text) blocks.push({ kind: "json-ld", selector: `script[type="application/ld+json"]:eq(${index})`, text: text.slice(0, 6000) });
  });

  const meta: Record<string, string> = {};
  $("meta[property], meta[name]").each((_, element) => {
    const key = $(element).attr("property") ?? $(element).attr("name");
    const value = $(element).attr("content");
    if (key && value && /title|price|availability|description|image|brand|product|og:|twitter:/i.test(key)) meta[key] = value;
  });
  if (Object.keys(meta).length > 0) {
    blocks.push({ kind: "meta", selector: "meta[property], meta[name]", text: JSON.stringify(meta).slice(0, 6000) });
  }

  return blocks;
}

function collectCandidates($: cheerio.CheerioAPI): CandidateElement[] {
  const candidates: CandidateElement[] = [];
  const selector = [
    "h1",
    "h2",
    "h3",
    "[id]",
    "[itemprop]",
    "[data-testid]",
    "[data-test]",
    "[aria-label]",
    "table",
    "article"
  ].join(",");

  $(selector).each((_, element) => {
    const tag = getTagName(element);
    const text = normalizeText($(element).text());
    if (!text || text.length < 2) return;

    const attributes = pickAttributes($, element);
    const candidateSelector = bestSelector($, element, attributes);
    const score = scoreCandidate(tag, text, attributes);
    candidates.push({ selector: candidateSelector, tag, text: text.slice(0, 500), attributes, score });
  });

  return candidates
    .sort((a, b) => b.score - a.score)
    .filter((candidate, index, list) => list.findIndex((item) => item.selector === candidate.selector && item.text === candidate.text) === index);
}

function buildReducedHtml($: cheerio.CheerioAPI, maxChars: number): string {
  const fragments: string[] = [];
  const seen = new Set<string>();
  const root = $.root();

  root.find("body > *").each((_, element) => {
    const tag = getTagName(element);
    if (["script", "style", "svg", "noscript", "iframe"].includes(tag)) return;
    const html = $.html(element);
    if (!html || seen.has(html)) return;
    seen.add(html);
    fragments.push(html);
    if (fragments.join("\n").length > maxChars) return false;
  });

  return fragments.join("\n").slice(0, maxChars);
}

function pickAttributes($: cheerio.CheerioAPI, element: any): Record<string, string> {
  const source = element.attribs ?? {};
  const attrs: Record<string, string> = {};
  for (const key of ["id", "class", "itemprop", "data-testid", "data-test", "aria-label", "href", "content", "property", "name"]) {
    if (source[key]) attrs[key] = String(source[key]).slice(0, 200);
  }
  return attrs;
}

function bestSelector($: cheerio.CheerioAPI, element: any, attrs: Record<string, string>): string {
  const tag = getTagName(element);
  if (attrs.id) return `#${cssEscape(attrs.id)}`;
  if (attrs["data-testid"]) return `${tag}[data-testid="${cssAttr(attrs["data-testid"])}"]`;
  if (attrs["data-test"]) return `${tag}[data-test="${cssAttr(attrs["data-test"])}"]`;
  if (attrs.itemprop) return `${tag}[itemprop="${cssAttr(attrs.itemprop)}"]`;
  if (attrs["aria-label"]) return `${tag}[aria-label="${cssAttr(attrs["aria-label"])}"]`;
  if (attrs.class) {
    const classes = attrs.class
      .split(/\s+/)
      .filter((name) => name && !/[0-9]{4,}|__[a-z0-9]{4,}|css-|sc-/i.test(name))
      .slice(0, 2);
    if (classes.length > 0) return `${tag}.${classes.map(cssEscape).join(".")}`;
  }
  const sameTag = $(tag).toArray();
  const index = Math.max(0, sameTag.indexOf(element));
  return `${tag}:eq(${index})`;
}

function scoreCandidate(tag: string, text: string, attrs: Record<string, string>): number {
  let score = 0;
  if (/^h[1-3]$/.test(tag)) score += 25;
  if (attrs.id) score += 12;
  if (attrs.itemprop) score += 16;
  if (attrs["data-testid"] || attrs["data-test"]) score += 14;
  if (text.length > 1200) score -= 20;
  if (text.length < 80) score += 8;
  return score;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function getTagName(element: any): string {
  return String(element.tagName ?? element.name ?? "node").toLowerCase();
}

function cssEscape(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function cssAttr(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
