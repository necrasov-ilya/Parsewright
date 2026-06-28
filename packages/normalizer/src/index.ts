export interface NormalizedCandidate {
  id: string;
  sourceCollection: string;
  title: string;
  url?: string;
  price?: number;
  currency?: string;
  seller?: string;
  durationDays?: number;
  fullText: string;
  raw: Record<string, unknown>;
  dedupeKey: string;
}

export interface NormalizeInput {
  data: Record<string, unknown>;
  baseUrl: string;
  maxItems?: number;
}

export function normalizeExtraction(input: NormalizeInput): NormalizedCandidate[] {
  const maxItems = input.maxItems ?? 2000;
  const candidates: NormalizedCandidate[] = [];

  for (const [collectionName, value] of Object.entries(input.data)) {
    if (!Array.isArray(value)) continue;
    for (const row of value.slice(0, maxItems)) {
      if (!row || typeof row !== "object") continue;
      const raw = row as Record<string, unknown>;
      const fullText = normalizeText(Object.values(raw).filter((item) => item !== null && item !== undefined).join(" "));
      const title = pickString(raw, ["title", "name", "description", "desc", "text"]) ?? fullText.slice(0, 220);
      const url = normalizeUrl(pickString(raw, ["url", "href", "link"]), input.baseUrl);
      const priceSource = pickValue(raw, ["price", "amount", "cost", "цена"]) ?? fullText;
      const price = typeof priceSource === "number" ? priceSource : parsePrice(String(priceSource));
      const currency = parseCurrency(String(priceSource ?? fullText));
      const seller = pickString(raw, ["seller", "vendor", "user", "author", "продавец"]);
      const durationDays = parseDurationDays(fullText);
      const dedupeKey = normalizeText(`${title}|${price ?? ""}|${seller ?? ""}`).toLowerCase();

      candidates.push({
        id: `${collectionName}-${candidates.length + 1}`,
        sourceCollection: collectionName,
        title,
        url,
        price,
        currency,
        seller,
        durationDays,
        fullText,
        raw,
        dedupeKey
      });
    }
  }

  return dedupe(candidates).slice(0, maxItems);
}

export function parsePrice(value: string): number | undefined {
  const match = value.replace(/\s/g, "").match(/[-+]?\d+(?:[,.]\d+)?/);
  if (!match) return undefined;
  const parsed = Number.parseFloat(match[0].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseDurationDays(value: string): number | undefined {
  const text = value.toLowerCase();
  const match = text.match(/(\d+(?:[,.]\d+)?)\s*(час|hour|дн|day|мес|month|год|year)/i);
  if (!match) return undefined;
  const amount = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(amount)) return undefined;
  const unit = match[2];
  if (/час|hour/i.test(unit)) return amount / 24;
  if (/дн|day/i.test(unit)) return amount;
  if (/мес|month/i.test(unit)) return amount * 30;
  if (/год|year/i.test(unit)) return amount * 365;
  return undefined;
}

function pickValue(raw: Record<string, unknown>, keys: string[]): unknown {
  const entries = Object.entries(raw);
  for (const key of keys) {
    const found = entries.find(([name]) => name.toLowerCase().includes(key));
    if (found) return found[1];
  }
  return undefined;
}

function pickString(raw: Record<string, unknown>, keys: string[]): string | undefined {
  const value = pickValue(raw, keys);
  if (typeof value !== "string") return undefined;
  const text = normalizeText(value);
  return text || undefined;
}

function normalizeUrl(value: string | undefined, baseUrl: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function parseCurrency(value: string): string | undefined {
  if (/₽|руб|rub/i.test(value)) return "RUB";
  if (/\$|usd/i.test(value)) return "USD";
  if (/€|eur/i.test(value)) return "EUR";
  return undefined;
}

function dedupe(candidates: NormalizedCandidate[]): NormalizedCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.url ?? candidate.dedupeKey;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
