import type { ParsewrightManifest } from "@parsewright/manifest";

export interface ValidationIssue {
  field?: string;
  code: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export interface PageCaptureMeta {
  status?: number;
  finalUrl?: string;
  html: string;
}

export function validatePage(meta: PageCaptureMeta): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (meta.status && (meta.status < 200 || meta.status >= 300)) {
    issues.push({ code: "page_status", message: `Expected HTTP 2xx, received ${meta.status}.` });
  }
  const inspectableHtml = stripNonVisibleHtml(meta.html).toLowerCase();
  const hasChallenge =
    inspectableHtml.includes("access denied") ||
    inspectableHtml.includes("verify you are human") ||
    /(?:solve|complete|enter|pass|verify|пройдите|введите|подтвердите|проверку)[^<]{0,100}captcha/i.test(inspectableHtml) ||
    /captcha[^<]{0,100}(?:solve|complete|enter|pass|verify|пройдите|введите|подтвердите|проверку)/i.test(inspectableHtml);
  if (hasChallenge) {
    issues.push({ code: "page_blocked", message: "Page looks blocked or challenged." });
  }
  if (meta.html.trim().length < 200) {
    issues.push({ code: "page_empty", message: "Captured HTML is unexpectedly small." });
  }
  return { ok: issues.length === 0, issues };
}

function stripNonVisibleHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "");
}

export function validateData(manifest: ParsewrightManifest, data: Record<string, unknown>): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (const [field, definition] of Object.entries(manifest.schema)) {
    const value = data[field];
    const absent = value === undefined || value === null || value === "";

    if (definition.required && !definition.nullable && absent) {
      issues.push({ field, code: "required", message: `${field} is required.` });
      continue;
    }

    if (absent) continue;

    if (!matchesType(value, definition.type)) {
      issues.push({ field, code: "type", message: `${field} should be ${definition.type}.` });
    }

    if (typeof value === "string" && value.length > definition.maxLength) {
      issues.push({ field, code: "max_length", message: `${field} is longer than ${definition.maxLength} characters.` });
    }
  }

  return { ok: issues.length === 0, issues };
}

function matchesType(value: unknown, type: string): boolean {
  if (type === "array") return Array.isArray(value);
  if (type === "object") return typeof value === "object" && value !== null && !Array.isArray(value);
  return typeof value === type;
}
