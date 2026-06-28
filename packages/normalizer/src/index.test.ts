import { describe, expect, it } from "vitest";
import { normalizeExtraction, parseDurationDays, parsePrice } from "./index.js";

describe("normalizer", () => {
  it("normalizes collection rows into candidates", () => {
    const candidates = normalizeExtraction({
      baseUrl: "https://example.com/catalog/",
      data: {
        offers: [
          { title: "ChatGPT Plus", price: "611 ₽", seller: "Shop", url: "/offer/1" },
          { title: "ChatGPT Plus", price: "611 ₽", seller: "Shop", url: "/offer/1" }
        ]
      }
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      title: "ChatGPT Plus",
      price: 611,
      currency: "RUB",
      seller: "Shop",
      url: "https://example.com/offer/1"
    });
  });

  it("parses prices and durations", () => {
    expect(parsePrice("1 923,50 ₽")).toBe(1923.5);
    expect(parseDurationDays("на 2 часа")).toBeCloseTo(2 / 24);
    expect(parseDurationDays("на 1 месяц")).toBe(30);
  });
});
