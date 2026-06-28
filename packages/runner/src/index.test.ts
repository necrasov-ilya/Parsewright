import { describe, expect, it } from "vitest";
import { runManifest } from "./index.js";
import type { ParsewrightManifest } from "@parsewright/manifest";

describe("runManifest", () => {
  it("extracts repeated collection items with relative selectors", () => {
    const html = `
      <a class="offer" href="/offer/1" data-kind="plus">
        <span class="title">ChatGPT Plus</span>
        <span class="price">611 ₽</span>
      </a>
      <a class="offer" href="/offer/2" data-kind="team">
        <span class="title">ChatGPT Team</span>
        <span class="price">1 923 ₽</span>
      </a>
    `;
    const manifest: ParsewrightManifest = {
      version: "0.1",
      id: "offers",
      name: "offers",
      goal: "best price",
      source: { url: "https://example.com", wait: { kind: "selector_or_timeout", timeoutMs: 10000, settleMs: 500 } },
      schema: { offers: { type: "array", required: true, nullable: false, maxLength: 2000 } },
      fields: {},
      collections: {
        offers: {
          selector: "a.offer",
          limit: 10,
          fields: {
            title: { selector: ".title", multiple: false, transforms: ["trim"] },
            price: { selector: ".price", multiple: false, transforms: ["price"] },
            url: { selector: ":scope", attribute: "href", multiple: false, transforms: ["trim"] },
            kind: { selector: ":scope", attribute: "data-kind", multiple: false, transforms: ["trim"] }
          }
        }
      },
      license: "MIT"
    };

    expect(runManifest({ manifest, html })).toEqual({
      offers: [
        { title: "ChatGPT Plus", price: 611, url: "/offer/1", kind: "plus" },
        { title: "ChatGPT Team", price: 1923, url: "/offer/2", kind: "team" }
      ]
    });
  });
});
