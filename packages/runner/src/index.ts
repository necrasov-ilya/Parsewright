import * as cheerio from "cheerio";
import type { ParsewrightManifest, Transform } from "@parsewright/manifest";

export type ExtractionData = Record<string, unknown>;

export interface RunManifestInput {
  manifest: ParsewrightManifest;
  html: string;
}

export function runManifest({ manifest, html }: RunManifestInput): ExtractionData {
  const $ = cheerio.load(html);
  const data: ExtractionData = {};

  for (const [field, rule] of Object.entries(manifest.fields)) {
    data[field] = extractRule($, $.root(), rule);
  }

  for (const [collectionName, collection] of Object.entries(manifest.collections)) {
    data[collectionName] = $(collection.selector)
      .toArray()
      .slice(0, collection.limit)
      .map((node) => {
        const item: Record<string, unknown> = {};
        const root = $(node);
        for (const [field, rule] of Object.entries(collection.fields)) {
          item[field] = extractRule($, root, rule);
        }
        return item;
      });
  }

  return data;
}

function extractRule($: cheerio.CheerioAPI, root: cheerio.Cheerio<any>, rule: ParsewrightManifest["fields"][string]): unknown {
  const nodes = rule.selector === ":scope" ? root : root.find(rule.selector);
  const values = nodes
    .toArray()
    .map((node) => {
      const value = rule.attribute ? $(node).attr(rule.attribute) : $(node).text();
      return applyTransforms(value ?? "", rule.transforms);
    })
    .filter((value) => value !== "");

  return rule.multiple ? values : values[0] ?? null;
}

function applyTransforms(raw: string, transforms: Transform[]): unknown {
  let value: unknown = raw;

  for (const transform of transforms) {
    if (transform === "trim" && typeof value === "string") value = value.trim();
    if (transform === "lowercase" && typeof value === "string") value = value.toLowerCase();
    if (transform === "uppercase" && typeof value === "string") value = value.toUpperCase();
    if ((transform === "number" || transform === "price") && typeof value === "string") {
      const normalized = value.replace(/\s/g, "").replace(/[^0-9,.-]/g, "").replace(",", ".");
      const number = Number.parseFloat(normalized);
      value = Number.isFinite(number) ? number : value;
    }
  }

  return value;
}
