import type { NormalizedCandidate } from "@parsewright/normalizer";
import type { ExtractionStrategy } from "@parsewright/manifest";

export interface RankedCandidate extends NormalizedCandidate {
  rank: number;
  relevanceScore: number;
  rankScore: number;
  matchedTerms: string[];
  rankReasons: string[];
}

export interface RankingResult {
  ranked: RankedCandidate[];
  best?: RankedCandidate;
  diagnostics: {
    inputCount: number;
    outputCount: number;
    queryTerms: string[];
  };
}

const STOPWORDS = new Set(["лучшее", "лучшие", "лучший", "предложение", "предложения", "по", "для", "на", "и", "the", "best", "price", "offer", "offers"]);
const PRICE_TERMS = new Set(["цена", "цене", "цены", "price", "pricing", "cost", "amount", "дешево", "дешевый", "дешевле", "cheap", "cheapest"]);
const ALIASES: Record<string, string[]> = {
  гпт: ["gpt", "chatgpt", "чатгпт"],
  гптшка: ["gpt", "chatgpt", "чатгпт"],
  gpt: ["chatgpt", "гпт", "чатгпт"],
  chatgpt: ["gpt", "гпт", "чатгпт"]
};

export function rankCandidates(candidates: NormalizedCandidate[], goal: string, strategy: ExtractionStrategy): RankingResult {
  const objective = strategy.ranking?.objective ?? "none";
  const topK = strategy.ranking?.topK ?? 20;
  const isPriceObjective = objective === "lowest_price" || objective === "highest_price";
  const isScoreObjective = objective === "highest_score" || objective === "lowest_score";
  const isDateObjective = objective === "newest" || objective === "oldest";
  const isAscending = objective === "lowest_price" || objective === "lowest_score" || objective === "oldest";
  const rawQueryTerms = tokenize(goal);
  const queryTerms = isPriceObjective ? rawQueryTerms.filter((term) => !PRICE_TERMS.has(term)) : rawQueryTerms;
  const ranked = candidates
    .map((candidate) => scoreCandidate(candidate, queryTerms, objective))
    .filter((candidate) => {
      if (queryTerms.length > 0) return candidate.relevanceScore > 0;
      if (isPriceObjective) return candidate.price !== undefined;
      return true;
    })
    .sort((a, b) => {
      if (isPriceObjective) {
        const priceA = a.price ?? (isAscending ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
        const priceB = b.price ?? (isAscending ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
        if (Math.abs(priceA - priceB) > 0.0001) return isAscending ? priceA - priceB : priceB - priceA;
      }
      return b.rankScore - a.rankScore;
    })
    .slice(0, topK)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  return {
    ranked,
    best: ranked[0],
    diagnostics: { inputCount: candidates.length, outputCount: ranked.length, queryTerms }
  };
}

function scoreCandidate(candidate: NormalizedCandidate, queryTerms: string[], objective: string): RankedCandidate {
  const haystack = candidate.fullText.toLowerCase();
  const matchedTerms = queryTerms.filter((term) => termMatches(term, haystack));
  const relevanceScore = queryTerms.length === 0 ? 1 : matchedTerms.length / queryTerms.length;
  const rankReasons: string[] = [];
  let rankScore = relevanceScore * 100;

  if (candidate.price !== undefined) {
    rankReasons.push(`price:${candidate.price}`);
    if (objective === "lowest_price") rankScore += Math.max(0, 50 - Math.log10(candidate.price + 1) * 10);
    else if (objective === "highest_price") rankScore += Math.min(50, Math.log10(candidate.price + 1) * 10);
  } else if (objective === "lowest_price" || objective === "highest_price") {
    rankScore -= 20;
    rankReasons.push("missing_price");
  }

  if (candidate.durationDays !== undefined && candidate.durationDays < 1) {
    rankScore -= 8;
    rankReasons.push("short_duration");
  }
  if (!candidate.url) {
    rankScore -= 4;
    rankReasons.push("missing_url");
  }
  if (matchedTerms.length > 0) rankReasons.push(`matched:${matchedTerms.join(",")}`);

  return { ...candidate, rank: 0, relevanceScore, rankScore, matchedTerms, rankReasons };
}

function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/ё/g, "е")
        .match(/[a-zа-я0-9]+/gi)
        ?.filter((term) => term.length > 2 && !STOPWORDS.has(term)) ?? []
    )
  );
}

function termMatches(term: string, haystack: string): boolean {
  if (haystack.includes(term)) return true;
  return (ALIASES[term] ?? []).some((alias) => haystack.includes(alias));
}
