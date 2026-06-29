import * as cheerio from "cheerio";

export interface PageContext {
  pageTitle?: string;
  reducedHtml: string;
  smartOutline: string;
  goalRelevantSections: GoalSection[];
  visibleText: string;
  candidates: CandidateElement[];
  repeatedGroups: RepeatedGroup[];
  structuredData: StructuredDataBlock[];
  stats: {
    originalHtmlLength: number;
    reducedHtmlLength: number;
    outlineLength: number;
    visibleTextLength: number;
    candidateCount: number;
    repeatedGroupCount: number;
    structuredDataCount: number;
  };
}

export interface GoalSection {
  selector: string;
  text: string;
  html: string;
  matchedKeywords: string[];
  score: number;
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
  const smartOutline = buildSmartOutline($, 15000);

  return {
    pageTitle,
    reducedHtml,
    smartOutline,
    goalRelevantSections: [],
    visibleText,
    candidates,
    repeatedGroups,
    structuredData,
    stats: {
      originalHtmlLength: html.length,
      reducedHtmlLength: reducedHtml.length,
      outlineLength: smartOutline.length,
      visibleTextLength: visibleText.length,
      candidateCount: candidates.length,
      repeatedGroupCount: repeatedGroups.length,
      structuredDataCount: structuredData.length
    }
  };
}

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "can", "need", "find", "get", "extract",
  "give", "show", "tell", "list", "all", "every", "each", "from", "about",
  "что", "это", "как", "для", "все", "всех", "найти", "получить", "извлечь",
  "покажи", "сделай", "и", "или", "на", "в", "с", "по", "от", "до",
  "me", "you", "us", "them", "it", "this", "that", "these", "those"
]);

export function findGoalRelevantSections(html: string, goal: string, maxSections: number = 8, maxHtmlChars: number = 12000): GoalSection[] {
  const $ = cheerio.load(html);
  $("script:not([type='application/ld+json']), style, svg, canvas, noscript, iframe").remove();

  const keywords = extractKeywords(goal);
  if (keywords.length === 0) return [];

  const patterns = keywords.map((kw) => ({
    keyword: kw,
    regex: new RegExp(escapeRegex(kw), "i")
  }));

  const skipTags = new Set(["script", "style", "svg", "noscript", "iframe", "canvas", "html", "body", "head"]);
  const scored: Array<{ element: any; text: string; matched: string[]; score: number; depth: number }> = [];

  function scoreElement(element: any, depth: number): void {
    const tag = getTagName(element);
    if (skipTags.has(tag)) return;

    const text = normalizeText($(element).text());
    if (text.length < 3 || text.length > 5000) return;

    const matched: string[] = [];
    let score = 0;

    for (const { keyword, regex } of patterns) {
      if (regex.test(text)) {
        matched.push(keyword);
        score += keyword.length > 4 ? 10 : 5;
      }
    }

    if (score === 0) return;

    const childCount = $(element).children().length;
    if (childCount > 10) score -= Math.min(childCount - 10, 20);
    if (text.length > 2000) score -= Math.min(Math.floor((text.length - 2000) / 100), 15);
    if (depth <= 3) score += 3;
    if (tag === "td" || tag === "th" || tag === "li" || tag === "dd" || tag === "dt") score += 5;
    if (tag === "h1" || tag === "h2" || tag === "h3") score += 4;
    if (tag === "table") score += 3;

    scored.push({ element, text, matched, score, depth });
  }

  function walk(element: any, depth: number): void {
    scoreElement(element, depth);
    $(element).children().each((_, child) => walk(child, depth + 1));
  }

  walk($.root().get(0) as any, 0);

  scored.sort((a, b) => b.score - a.score);

  const seen = new Set<any>();
  const results: GoalSection[] = [];
  let totalHtml = 0;

  for (const item of scored) {
    if (results.length >= maxSections) break;
    if (seen.has(item.element)) continue;

    let dominated = false;
    for (const existing of seen) {
      if ($(existing).has(item.element).length > 0) { dominated = true; break; }
    }
    if (dominated) continue;

    let current = item.element;
    for (let i = 0; i < 1; i++) {
      const parent = $(current).parent();
      if (parent.length === 0 || parent.is("body") || parent.is("html")) break;
      if (normalizeText($(parent).text()).length > 3000) break;
      current = parent.get(0) as any;
    }

    seen.add(current);
    const sectionHtml = $.html(current);
    if (totalHtml + sectionHtml.length > maxHtmlChars) {
      const remaining = maxHtmlChars - totalHtml;
      if (remaining > 200) {
        results.push({
          selector: bestSelector($, current, pickAttributes($, current)),
          text: item.text.slice(0, 500),
          html: sectionHtml.slice(0, remaining),
          matchedKeywords: item.matched,
          score: item.score
        });
        totalHtml = maxHtmlChars;
      }
      break;
    }

    results.push({
      selector: bestSelector($, current, pickAttributes($, current)),
      text: item.text.slice(0, 500),
      html: sectionHtml,
      matchedKeywords: item.matched,
      score: item.score
    });
    totalHtml += sectionHtml.length;
  }

  return results;
}

function extractKeywords(goal: string): string[] {
  const words = goal
    .toLowerCase()
    .replace(/[^\w\u0400-\u04FF\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  const unique = [...new Set(words)];

  const currencyPatterns = ["price", "cost", "amount", "руб", "usd", "eur", "gbp", "₽", "$", "£", "€", "цена", "стоимость"];
  for (const pattern of currencyPatterns) {
    if (goal.toLowerCase().includes(pattern) && !unique.includes(pattern)) {
      unique.push(pattern);
    }
  }

  const numbers = goal.match(/\d{2,}/g);
  if (numbers) {
    for (const num of numbers) {
      if (!unique.includes(num)) unique.push(num);
    }
  }

  return unique.slice(0, 12);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  const fragments: Array<{ html: string; priority: number }> = [];
  const seen = new Set<string>();
  const root = $.root();

  const navKeywords = /nav|menu|header|footer|sidebar|breadcrumb|pagination|social|cookie|banner|advert/i;
  const contentKeywords = /product|item|card|result|listing|article|content|main|detail|price|offer|table|data/i;

  root.find("body > *").each((_, element) => {
    const tag = getTagName(element);
    if (["script", "style", "svg", "noscript", "iframe"].includes(tag)) return;
    const html = $.html(element);
    if (!html || seen.has(html)) return;
    seen.add(html);

    const attrs = pickAttributes($, element);
    const classId = `${attrs.id ?? ""} ${attrs.class ?? ""}`.toLowerCase();
    let priority = 1;

    if (navKeywords.test(classId)) priority = 0;
    else if (contentKeywords.test(classId)) priority = 3;
    else if (tag === "main" || tag === "article" || tag === "table") priority = 3;
    else if (tag === "header" || tag === "footer" || tag === "nav" || tag === "aside") priority = 0;
    else if (attrs.itemprop || attrs["data-testid"] || attrs["data-test"]) priority = 3;
    else priority = 1;

    fragments.push({ html, priority });
  });

  fragments.sort((a, b) => b.priority - a.priority);

  const result: string[] = [];
  let totalLen = 0;
  for (const frag of fragments) {
    if (totalLen + frag.html.length > maxChars) {
      const remaining = maxChars - totalLen;
      if (remaining > 200) result.push(frag.html.slice(0, remaining));
      break;
    }
    result.push(frag.html);
    totalLen += frag.html.length;
  }

  return result.join("\n");
}

function buildSmartOutline($: cheerio.CheerioAPI, maxChars: number): string {
  const lines: string[] = [];
  const navKeywords = /nav|menu|footer|sidebar|breadcrumb|pagination|social|cookie|banner|advert/i;
  const skipTags = new Set(["script", "style", "svg", "noscript", "iframe", "canvas", "img", "br", "hr", "input", "button"]);

  function walk(element: any, depth: number): boolean {
    if (lines.join("\n").length >= maxChars) return false;

    const tag = getTagName(element);
    if (skipTags.has(tag)) return true;

    const attrs = pickAttributes($, element);
    const text = normalizeText($(element).text());
    const classId = `${attrs.id ?? ""} ${attrs.class ?? ""}`.toLowerCase();

    if (depth > 0 && navKeywords.test(classId) && depth > 1) return true;
    if (tag === "header" || tag === "footer" || tag === "nav" || tag === "aside") {
      if (depth > 0) {
        const childCount = $(element).find("a").length;
        lines.push(`${"  ".repeat(depth)}<${tag}${attrs.id ? ` id="${attrs.id}"` : ""}${attrs.class ? ` class="${attrs.class}"` : ""}> → ${childCount} links`);
        return true;
      }
    }

    const children = $(element).children().toArray();
    const hasBlockChildren = children.some((child) => {
      const childTag = getTagName(child);
      return !skipTags.has(childTag) && ["div", "section", "article", "ul", "ol", "table", "main", "header", "form", "p"].includes(childTag);
    });

    const selector = bestSelector($, element, attrs);
    const attrStr = [
      attrs.id ? `#${attrs.id}` : "",
      attrs.class ? ` class="${attrs.class}"` : "",
      attrs.itemprop ? ` itemprop="${attrs.itemprop}"` : "",
      attrs["data-testid"] ? ` data-testid="${attrs["data-testid"]}"` : "",
    ].join("");

    if (!hasBlockChildren || children.length === 0) {
      const sampleText = text.length > 80 ? `${text.slice(0, 60)}…` : text;
      if (sampleText) {
        lines.push(`${"  ".repeat(depth)}<${tag}${attrStr}> → "${sampleText}" (${text.length} chars)`);
      } else {
        lines.push(`${"  ".repeat(depth)}<${tag}${attrStr}>`);
      }
      return true;
    }

    lines.push(`${"  ".repeat(depth)}<${tag}${attrStr}>`);
    for (const child of children) {
      if (lines.join("\n").length >= maxChars) break;
      walk(child, depth + 1);
    }
    return true;
  }

  const body = $("body");
  if (body.length > 0) {
    for (const child of body.children().toArray()) {
      if (lines.join("\n").length >= maxChars) break;
      walk(child, 0);
    }
  }

  return lines.join("\n").slice(0, maxChars);
}

export function findHtmlSection(html: string, selector: string, contextChars: number = 8000): string {
  const $ = cheerio.load(html);
  $("script:not([type='application/ld+json']), style, svg, canvas, noscript, iframe").remove();

  let target = $(selector).first();
  if (target.length === 0) {
    const tag = selector.split(/[.#\[]/)[0];
    if (tag) target = $(tag).first();
  }

  if (target.length === 0) return html.slice(0, contextChars);

  let current = target;
  for (let i = 0; i < 2; i++) {
    const parent = current.parent();
    if (parent.length === 0 || parent.is("body") || parent.is("html")) break;
    current = parent;
  }

  const sectionHtml = $.html(current);
  if (sectionHtml.length <= contextChars) return sectionHtml;

  const targetHtml = $.html(target);
  const targetStart = sectionHtml.indexOf(targetHtml);
  if (targetStart === -1) return sectionHtml.slice(0, contextChars);

  const halfContext = Math.floor((contextChars - targetHtml.length) / 2);
  const start = Math.max(0, targetStart - halfContext);
  const end = Math.min(sectionHtml.length, start + contextChars);
  return sectionHtml.slice(start, end);
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
