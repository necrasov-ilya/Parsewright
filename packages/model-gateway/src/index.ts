import { createManifestId, ParsewrightManifestSchema, type ExtractionStrategy, type ParsewrightManifest } from "@parsewright/manifest";
import type { PageContext } from "@parsewright/page-reducer";

export interface ModelGateway {
  planStrategy(input: PlanStrategyInput): Promise<ExtractionStrategy>;
  generateManifest(input: GenerateManifestInput): Promise<ParsewrightManifest>;
  repairManifest?(input: RepairManifestInput): Promise<ParsewrightManifest>;
  classifyCandidates?(input: ClassifyCandidatesInput): Promise<CandidateClassification[]>;
  verifyAndCompose(input: VerifyAndComposeInput): Promise<VerifyAndComposeResult>;
}

export interface PlanStrategyInput {
  url: string;
  goal: string;
  title?: string;
  pageContext?: PageContext;
}

export interface GenerateManifestInput {
  url: string;
  goal: string;
  strategy: ExtractionStrategy;
  title?: string;
  html: string;
  pageContext?: PageContext;
}

export interface RepairManifestInput extends GenerateManifestInput {
  previousManifest: ParsewrightManifest;
  data?: Record<string, unknown>;
  issues: Array<{ field?: string; code: string; message: string }>;
}

export interface ClassifyCandidatesInput {
  goal: string;
  candidates: CandidateForClassification[];
}

export interface CandidateForClassification {
  id: string;
  title: string;
  fullText: string;
  price?: number;
  currency?: string;
  seller?: string;
  url?: string;
}

export interface CandidateClassification {
  id: string;
  match: boolean;
  confidence: number;
  reason: string;
  extractedFacts: Record<string, unknown>;
}

export interface VerifyAndComposeInput {
  goal: string;
  strategy: ExtractionStrategy;
  data: Record<string, unknown>;
  candidates?: Array<Record<string, unknown>>;
  pageTitle?: string;
}

export interface VerifyAndComposeResult {
  answersGoal: boolean;
  answer: string;
  issues: string[];
}

export interface OpenAICompatibleOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  provider?: ModelProviderId;
}

export type ModelProviderId = "openai" | "fireworks" | "openai-compatible";

export interface ModelProviderPreset {
  id: ModelProviderId;
  label: string;
  baseUrl: string;
  defaultModel: string;
  envKey: string;
}

export const MODEL_PROVIDER_PRESETS: Record<ModelProviderId, ModelProviderPreset> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1-mini",
    envKey: "OPENAI_API_KEY"
  },
  fireworks: {
    id: "fireworks",
    label: "Fireworks AI",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    defaultModel: "accounts/fireworks/models/deepseek-v4-pro",
    envKey: "FIREWORKS_API_KEY"
  },
  "openai-compatible": {
    id: "openai-compatible",
    label: "OpenAI-compatible",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1-mini",
    envKey: "OPENAI_API_KEY"
  }
};

export function listModelProviders(): ModelProviderPreset[] {
  return Object.values(MODEL_PROVIDER_PRESETS);
}

export interface ModelRuntimeConfig {
  provider: ModelProviderId;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export function createModelGateway(config: ModelRuntimeConfig): OpenAICompatibleGateway {
  const preset = MODEL_PROVIDER_PRESETS[config.provider];
  return new OpenAICompatibleGateway({
    provider: config.provider,
    apiKey: config.apiKey,
    baseUrl: normalizeBaseUrl(config.baseUrl ?? preset.baseUrl),
    model: config.model ?? preset.defaultModel
  });
}

export class OpenAICompatibleGateway implements ModelGateway {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(private readonly options: OpenAICompatibleOptions) {
    const preset = options.provider ? MODEL_PROVIDER_PRESETS[options.provider] : MODEL_PROVIDER_PRESETS.openai;
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? preset.baseUrl);
    this.model = options.model ?? preset.defaultModel;
  }

  async planStrategy(input: PlanStrategyInput): Promise<ExtractionStrategy> {
    const response = await this.chat({
      messages: buildPlanStrategyMessages(input),
      responseFormat: "json_object"
    });
    const parsed = JSON.parse(response) as ExtractionStrategy;
    return normalizeStrategy(parsed);
  }

  async generateManifest(input: GenerateManifestInput): Promise<ParsewrightManifest> {
    return this.requestManifest(buildGenerateMessages(input), input.url, input.goal, input.strategy);
  }

  async repairManifest(input: RepairManifestInput): Promise<ParsewrightManifest> {
    return this.requestManifest(buildRepairMessages(input), input.url, input.goal, input.strategy);
  }

  async classifyCandidates(input: ClassifyCandidatesInput): Promise<CandidateClassification[]> {
    const response = await this.chat({
      messages: [
        { role: "system", content: CANDIDATE_CLASSIFIER_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            task: "classify_ranked_candidates",
            goal: input.goal,
            candidates: input.candidates.slice(0, 30).map((candidate) => ({
              ...candidate,
              fullText: candidate.fullText.slice(0, 1200)
            })),
            requiredShape: { classifications: [{ id: "candidate id", match: true, confidence: 0.9, reason: "short reason", extractedFacts: {} }] }
          })
        }
      ],
      responseFormat: "json_object"
    });

    const parsed = JSON.parse(response) as { classifications?: CandidateClassification[] };
    return Array.isArray(parsed.classifications) ? parsed.classifications : [];
  }

  async verifyAndCompose(input: VerifyAndComposeInput): Promise<VerifyAndComposeResult> {
    const response = await this.chat({
      messages: buildVerifyAndComposeMessages(input),
      responseFormat: "json_object"
    });
    const parsed = JSON.parse(response) as VerifyAndComposeResult;
    return {
      answersGoal: Boolean(parsed.answersGoal),
      answer: typeof parsed.answer === "string" ? parsed.answer : "",
      issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : []
    };
  }

  private async chat(params: { messages: Array<{ role: "system" | "user"; content: string }>; responseFormat?: "json_object" }): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        ...(params.responseFormat ? { response_format: { type: params.responseFormat } } : {}),
        messages: params.messages
      })
    });

    if (!response.ok) {
      throw new Error(`Model request failed with ${response.status}: ${await response.text()}`);
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Model returned an empty response.");
    return content;
  }

  private async requestManifest(
    messages: Array<{ role: "system" | "user"; content: string }>,
    url: string,
    goal: string,
    strategy: ExtractionStrategy
  ): Promise<ParsewrightManifest> {
    const content = await this.chat({ messages, responseFormat: "json_object" });
    const manifest = ParsewrightManifestSchema.parse(normalizeManifestJson(JSON.parse(content)));
    return {
      ...manifest,
      strategy,
      id: manifest.id || createManifestId(url, goal),
      source: {
        ...manifest.source,
        url
      },
      goal,
      updatedAt: new Date().toISOString()
    };
  }
}

export class HeuristicGateway implements ModelGateway {
  async planStrategy(input: PlanStrategyInput): Promise<ExtractionStrategy> {
    const { heuristicStrategy } = await import("@parsewright/planner");
    return heuristicStrategy(input.goal);
  }

  async generateManifest(input: GenerateManifestInput): Promise<ParsewrightManifest> {
    const id = createManifestId(input.url, input.goal);
    const fieldNames = input.strategy.fields ?? defaultFieldNames(input.goal);
    const schema = Object.fromEntries(fieldNames.map((field) => [field, { type: "string" as const, required: true, nullable: false, maxLength: 500 }]));
    const rules = Object.fromEntries(fieldNames.map((field) => [field, { selector: field.includes("title") ? "h1" : "body", multiple: false, transforms: ["trim" as const] }]));

    return {
      version: "0.1",
      id,
      name: id,
      goal: input.goal,
      strategy: input.strategy,
      source: {
        url: input.url,
        wait: { kind: "selector_or_timeout", timeoutMs: 10000, settleMs: 500 }
      },
      schema,
      fields: rules,
      collections: {},
      license: "MIT",
      createdAt: new Date().toISOString()
    };
  }

  async verifyAndCompose(input: VerifyAndComposeInput): Promise<VerifyAndComposeResult> {
    const entries = Object.entries(input.data).filter(([, value]) => value !== null && value !== undefined && value !== "");
    if (entries.length === 0) {
      return { answersGoal: false, answer: "No data was extracted from the page.", issues: ["empty_result"] };
    }
    const summary = entries.map(([key, value]) => `${key}: ${value}`).join(", ");
    return { answersGoal: true, answer: summary, issues: [] };
  }
}

function defaultFieldNames(goal: string): string[] {
  return goal
    .split(/[,;\n]+/)
    .map((field) => field.trim().toLowerCase().replace(/[^a-z0-9_ -]/g, "").replace(/\s+/g, "_"))
    .filter(Boolean);
}

function normalizeStrategy(value: unknown): ExtractionStrategy {
  if (!value || typeof value !== "object") return { kind: "fields" };
  const obj = value as Record<string, unknown>;
  const kind = obj.kind;
  if (kind === "collection") {
    const ranking = obj.ranking as Record<string, unknown> | undefined;
    return {
      kind: "collection",
      fields: Array.isArray(obj.fields) ? obj.fields.map(String) : undefined,
      ranking: ranking && typeof ranking.objective === "string"
        ? { objective: ranking.objective as "lowest_price" | "highest_score" | "relevance" | "none", topK: typeof ranking.topK === "number" ? ranking.topK : 20 }
        : undefined
    };
  }
  if (kind === "summary") {
    return { kind: "summary", fields: Array.isArray(obj.fields) ? obj.fields.map(String) : undefined };
  }
  return { kind: "fields", fields: Array.isArray(obj.fields) ? obj.fields.map(String) : undefined };
}

function buildPlanStrategyMessages(input: PlanStrategyInput): Array<{ role: "system" | "user"; content: string }> {
  const ctx = input.pageContext;
  return [
    { role: "system", content: PLAN_STRATEGY_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        task: "plan_extraction_strategy",
        url: input.url,
        goal: input.goal,
        pageTitle: input.title,
        pageContext: ctx
          ? {
              pageTitle: ctx.pageTitle,
              visibleText: ctx.visibleText.slice(0, 8000),
              repeatedGroups: ctx.repeatedGroups.map((group) => ({
                selector: group.selector,
                count: group.count,
                fieldHints: group.fieldHints,
                sampleText: group.sampleTexts[0]?.slice(0, 200)
              })),
              structuredData: ctx.structuredData.map((block) => ({ kind: block.kind, text: block.text.slice(0, 500) }))
            }
          : undefined,
        requiredShape: {
          kind: "fields | collection | summary",
          fields: ["optional list of expected field names"],
          ranking: { objective: "lowest_price | highest_score | relevance | none", topK: 20 }
        }
      })
    }
  ];
}

function buildGenerateMessages(input: GenerateManifestInput): Array<{ role: "system" | "user"; content: string }> {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        task: "generate_parsewright_manifest",
        url: input.url,
        goal: input.goal,
        strategy: input.strategy,
        pageTitle: input.title,
        pageContext: input.pageContext ?? {
          reducedHtml: input.html.slice(0, 45000)
        },
        requiredShape: manifestShape(input.url, input.goal, input.strategy)
      })
    }
  ];
}

function buildRepairMessages(input: RepairManifestInput): Array<{ role: "system" | "user"; content: string }> {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        task: "repair_parsewright_manifest",
        url: input.url,
        goal: input.goal,
        strategy: input.strategy,
        pageTitle: input.title,
        previousManifest: input.previousManifest,
        previousData: input.data,
        validationIssues: input.issues,
        pageContext: input.pageContext ?? {
          reducedHtml: input.html.slice(0, 45000)
        },
        requiredShape: manifestShape(input.url, input.goal, input.strategy)
      })
    }
  ];
}

function buildVerifyAndComposeMessages(input: VerifyAndComposeInput): Array<{ role: "system" | "user"; content: string }> {
  const dataPreview = input.candidates && input.candidates.length > 0
    ? { kind: "collection", count: input.candidates.length, top: input.candidates.slice(0, 10) }
    : { kind: input.strategy.kind, data: input.data };

  return [
    { role: "system", content: VERIFY_AND_COMPOSE_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        task: "verify_and_compose",
        goal: input.goal,
        strategy: input.strategy,
        pageTitle: input.pageTitle,
        extractionResult: dataPreview,
        requiredShape: {
          answersGoal: true,
          answer: "natural language answer in the user's language",
          issues: ["list any problems, empty if all good"]
        }
      })
    }
  ];
}

const SYSTEM_PROMPT = [
  "You generate deterministic Parsewright manifests for web data extraction.",
  "Return only valid JSON. No markdown. No commentary.",
  "The manifest must match the provided shape exactly.",
  "An extraction strategy is provided. Follow it strictly:",
  "- If strategy.kind is 'fields', generate page-level field selectors (one value per field).",
  "- If strategy.kind is 'collection', generate a collection with a stable item selector and relative field selectors. Use :scope when extracting text or attributes from the item itself.",
  "- If strategy.kind is 'summary', generate field selectors for the key information needed to summarize the page.",
  "Prefer stable selectors in this order: itemprop, data-testid/data-test, id, aria-label, semantic tags, then classes.",
  "Avoid random-looking CSS module, Tailwind utility, hashed, and framework-generated classes when possible.",
  "Use JSON-LD/meta context to understand the page, but v0 manifest fields must use CSS selectors against HTML.",
  "Every field listed in strategy.fields must appear in both schema and fields (or collections for collection strategy).",
  "Use type number only when a numeric transform can reliably convert the extracted text.",
  "Use transforms only from this list: trim, number, price, lowercase, uppercase.",
  "Use multiple=true only for list fields.",
  "Use maxLength 500 for ordinary strings and 2000 for descriptions or arrays represented as text.",
  "Set source.wait.kind to selector_or_timeout and selector to the strongest selector needed for the page content."
].join("\n");

const PLAN_STRATEGY_PROMPT = [
  "You decide the extraction strategy for a web page.",
  "Return only valid JSON. No markdown. No commentary.",
  "Read the user's goal and the page context, then choose one strategy kind:",
  "- 'fields': the user wants specific named values from a single page (e.g. title, price, availability of one product).",
  "- 'collection': the user wants to find, compare, list, or rank multiple items (e.g. all offers, cheapest product, search results).",
  "- 'summary': the user wants a natural-language overview or digest of the page content.",
  "If the strategy is 'fields' or 'summary', list the expected field names in the 'fields' array when they can be inferred from the goal.",
  "If the strategy is 'collection' and the user wants ranking (best, cheapest, top, compare), set ranking.objective accordingly. Use 'none' when no ranking is needed.",
  "Respond in the same language as the user's goal when naming fields."
].join("\n");

const VERIFY_AND_COMPOSE_PROMPT = [
  "You verify extraction results and compose a natural-language answer.",
  "Return only valid JSON. No markdown. No commentary.",
  "Your job:",
  "1. Decide whether the extracted data actually answers the user's goal. Set answersGoal to true or false.",
  "2. Compose a concise natural-language answer in the user's language.",
  "   - For 'fields' strategy: state each field value clearly (e.g. 'Title: X, Price: Y, Availability: Z').",
  "   - For 'collection' strategy with ranking: state the best item and mention the total count (e.g. 'Found 20 offers. Cheapest: X for Y.').",
  "   - For 'collection' strategy without ranking: summarize what was found.",
  "   - For 'summary' strategy: write a short digest of the page content.",
  "3. List any issues: missing fields, wrong values, empty results, or mismatches with the goal. Empty array if all good.",
  "Be honest. If the data does not answer the goal, say so in the answer and list the issues."
].join("\n");

const CANDIDATE_CLASSIFIER_PROMPT = [
  "You classify already-extracted web candidates against the user's goal.",
  "Return only valid JSON. No markdown. No commentary.",
  "Do not rank by price. Ranking was already done by deterministic code.",
  "For each candidate, decide whether it semantically matches the goal.",
  "Use confidence from 0 to 1.",
  "Keep reasons short and concrete."
].join("\n");

function manifestShape(url: string, goal: string, strategy: ExtractionStrategy) {
  const id = createManifestId(url, goal);
  return {
    version: "0.1",
    id,
    name: id,
    goal,
    strategy,
    source: { url, wait: { kind: "selector_or_timeout", selector: "optional css selector", timeoutMs: 10000, settleMs: 500 } },
    schema: { field_name: { type: "string|number|boolean|array|object", required: true, nullable: false, maxLength: 500 } },
    fields: { field_name: { selector: "css selector", attribute: "optional attribute name", multiple: false, transforms: ["trim"] } },
    collections: {
      collection_name: {
        selector: "css selector for repeated item",
        limit: 500,
        fields: {
          item_field: { selector: "relative css selector or :scope", attribute: "optional attribute name", multiple: false, transforms: ["trim"] }
        }
      }
    },
    license: "MIT"
  };
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function normalizeManifestJson(value: any): unknown {
  if (!value || typeof value !== "object") return value;
  if (value.source?.wait?.selector === null) delete value.source.wait.selector;
  if (value.fields && typeof value.fields === "object") {
    for (const rule of Object.values<any>(value.fields)) {
      if (rule && typeof rule === "object") {
        if (rule.attribute === null) delete rule.attribute;
        if (rule.multiple === null) rule.multiple = false;
        if (rule.transforms === null) rule.transforms = [];
      }
    }
  }
  if (value.collections && typeof value.collections === "object") {
    for (const collection of Object.values<any>(value.collections)) {
      if (!collection || typeof collection !== "object") continue;
      if (collection.limit === null) delete collection.limit;
      if (!collection.fields || typeof collection.fields !== "object") continue;
      for (const rule of Object.values<any>(collection.fields)) {
        if (rule && typeof rule === "object") {
          if (rule.attribute === null) delete rule.attribute;
          if (rule.multiple === null) rule.multiple = false;
          if (rule.transforms === null) rule.transforms = [];
        }
      }
    }
  }
  return value;
}
