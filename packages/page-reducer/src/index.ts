import * as cheerio from "cheerio";

export interface PageContext {
  pageTitle?: string;
  reducedHtml: string;
  visibleText: string;
  candidates: CandidateElement[];
  structuredData: StructuredDataBlock[];
  stats: {
    originalHtmlLength: number;
    reducedHtmlLength: number;
    visibleTextLength: number;
    candidateCount: number;
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
  const visibleText = normalizeText($("body").text()).slice(0, opts.maxTextChars);
  const reducedHtml = buildReducedHtml($, candidates, opts.maxHtmlChars);

  return {
    pageTitle,
    reducedHtml,
    visibleText,
    candidates,
    structuredData,
    stats: {
      originalHtmlLength: html.length,
      reducedHtmlLength: reducedHtml.length,
      visibleTextLength: visibleText.length,
      candidateCount: candidates.length,
      structuredDataCount: structuredData.length
    }
  };
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
    "[class]",
    "[itemprop]",
    "[data-testid]",
    "[data-test]",
    "[aria-label]",
    "table",
    "li",
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

function buildReducedHtml($: cheerio.CheerioAPI, candidates: CandidateElement[], maxChars: number): string {
  const fragments: string[] = [];
  for (const candidate of candidates) {
    const element = $(candidate.selector).first();
    if (element.length === 0) continue;
    fragments.push($.html(element));
    if (fragments.join("\n").length > maxChars) break;
  }
  const joined = fragments.join("\n");
  return joined.slice(0, maxChars);
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
  if (/\$|€|£|₽|руб|usd|eur|price|цена/i.test(`${text} ${Object.values(attrs).join(" ")}`)) score += 22;
  if (/stock|available|availability|налич|доступ/i.test(`${text} ${Object.values(attrs).join(" ")}`)) score += 12;
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
