import { describe, expect, it } from "vitest";
import { rankCandidates } from "./index.js";
import type { NormalizedCandidate } from "@parsewright/normalizer";
import type { ExtractionStrategy } from "@parsewright/manifest";

describe("rankCandidates", () => {
  it("keeps relevant candidates and prefers the lowest price for best-offer goals", () => {
    const candidates: NormalizedCandidate[] = [
      candidate("1", "ChatGPT Plus expensive", 900),
      candidate("2", "ChatGPT Plus cheap", 300),
      candidate("3", "Netflix cheap", 100)
    ];

    const strategy: ExtractionStrategy = {
      kind: "collection",
      ranking: { objective: "lowest_price", topK: 20 }
    };
    const result = rankCandidates(candidates, "лучшее предложение по гпт", strategy);

    expect(result.best?.id).toBe("2");
    expect(result.ranked.map((item) => item.id)).not.toContain("3");
  });

  it("keeps price-bearing candidates for pure price-objective goals", () => {
    const candidates: NormalizedCandidate[] = [
      candidate("1", "ChatGPT Plus 1 мес", 900),
      candidate("2", "ChatGPT Plus 1 мес", 300),
      candidate("3", "Подарок к аккаунту", 0)
    ];

    const strategy: ExtractionStrategy = {
      kind: "collection",
      ranking: { objective: "lowest_price", topK: 20 }
    };
    const result = rankCandidates(candidates, "лучшее предложение по цене", strategy);

    expect(result.diagnostics.outputCount).toBe(3);
    expect(result.best?.id).toBe("3");
    expect(result.diagnostics.queryTerms).toEqual([]);
  });
});

function candidate(id: string, title: string, price: number): NormalizedCandidate {
  return {
    id,
    sourceCollection: "offers",
    title,
    price,
    currency: "RUB",
    fullText: title,
    raw: { title, price },
    dedupeKey: id
  };
}
