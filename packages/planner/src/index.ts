export type { ExtractionStrategy, StrategyKind, RankingObjective } from "@parsewright/manifest";
import type { ExtractionStrategy } from "@parsewright/manifest";

export function heuristicStrategy(goal: string): ExtractionStrategy {
  const text = goal.toLowerCase().trim();

  const commaFields = goal
    .split(/[,;\n]+/)
    .map((field) => field.trim().toLowerCase().replace(/[^a-z0-9_ -]/g, "").replace(/\s+/g, "_"))
    .filter(Boolean);

  const looksLikeFieldList = commaFields.length >= 2 && commaFields.every((field) => field.length <= 40) && commaFields.length <= 10;

  if (looksLikeFieldList) return { kind: "fields", fields: commaFields };

  const wantsSummary = /summary|summarize|обзор|резюме|описан|tl;dr/i.test(text);
  const wantsBest = /луч|best|cheapest|дешев|top|топ|предлож|сравн|compare|versus| vs /i.test(text);
  const wantsList = /list|lists|listing|all|every|each|найди|список|все|кажд|offers?|results?|rows?|items?|пункты|товар/i.test(text);

  if (wantsSummary) return { kind: "summary" };

  if (wantsList || wantsBest) {
    return {
      kind: "collection",
      ranking: wantsBest ? { objective: "lowest_price", topK: 20 } : undefined
    };
  }

  const singleField = commaFields.length === 1 ? commaFields[0] : undefined;
  return { kind: "fields", fields: singleField ? [singleField] : undefined };
}
