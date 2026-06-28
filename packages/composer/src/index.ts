import type { ExtractionStrategy } from "@parsewright/manifest";

export interface DeterministicComposeInput {
  goal: string;
  strategy: ExtractionStrategy;
  data: Record<string, unknown>;
  candidates?: Array<Record<string, unknown>>;
  pageTitle?: string;
}

export interface DeterministicComposeResult {
  answersGoal: boolean;
  answer: string;
  issues: string[];
}

export function composeDeterministic(input: DeterministicComposeInput): DeterministicComposeResult {
  const issues: string[] = [];
  const entries = Object.entries(input.data).filter(([, value]) => value !== null && value !== undefined && value !== "");

  if (entries.length === 0 && (!input.candidates || input.candidates.length === 0)) {
    return { answersGoal: false, answer: "No data was extracted from the page.", issues: ["empty_result"] };
  }

  if (input.strategy.kind === "collection") {
    const count = input.candidates?.length ?? 0;
    if (count === 0) {
      return { answersGoal: false, answer: "No items were found on the page.", issues: ["empty_collection"] };
    }
    const best = input.candidates?.[0];
    const bestLabel = best ? formatItem(best) : "";
    const answer = `Found ${count} item${count === 1 ? "" : "s"}.${bestLabel ? ` Best: ${bestLabel}.` : ""}`;
    return { answersGoal: true, answer, issues };
  }

  const missing = (input.strategy.fields ?? []).filter((field) => input.data[field] === null || input.data[field] === undefined || input.data[field] === "");
  if (missing.length > 0) issues.push(`missing_fields:${missing.join(",")}`);

  const summary = entries.map(([key, value]) => `${key}: ${formatValue(value)}`).join(", ");
  return { answersGoal: missing.length === 0, answer: summary, issues };
}

function formatItem(item: Record<string, unknown>): string {
  const title = String(item.title ?? item.name ?? "");
  const price = item.price !== undefined ? ` for ${item.price}${item.currency ? ` ${item.currency}` : ""}` : "";
  return `${title}${price}`;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} items`;
  return String(value);
}
