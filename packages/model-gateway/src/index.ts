import { createManifestId, ParsewrightManifestSchema, type ExtractionStrategy, type ParsewrightManifest } from "@parsewright/manifest";
import type { PageContext, StructuredDataBlock, CandidateElement, RepeatedGroup, GoalSection } from "@parsewright/page-reducer";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface CodeGenInput {
  manifest: ParsewrightManifest;
  language: "python" | "javascript" | "curl";
  includeDocs: boolean;
  extraRequirements?: string;
  onChunk?: (text: string) => void;
}

export interface CodeGenResult {
  code: string;
  usage: TokenUsage;
}

export interface ModelGateway {
  planStrategy(input: PlanStrategyInput): Promise<ExtractionStrategy>;
  generateManifest(input: GenerateManifestInput): Promise<ParsewrightManifest>;
  repairManifest?(input: RepairManifestInput): Promise<ParsewrightManifest>;
  classifyCandidates?(input: ClassifyCandidatesInput): Promise<CandidateClassification[]>;
  verifyAndCompose(input: VerifyAndComposeInput): Promise<VerifyAndComposeResult>;
  generateCode?(input: CodeGenInput): Promise<CodeGenResult>;
  getAccumulatedUsage(): TokenUsage;
  resetUsage(): void;
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
  outline?: string;
  structuredData?: StructuredDataBlock[];
  candidates?: CandidateElement[];
  repeatedGroups?: RepeatedGroup[];
  goalRelevantSections?: GoalSection[];
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
  title: string;
  issues: string[];
}

export interface OpenAICompatibleOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  provider?: ModelProviderId;
}

export type ModelProviderId =
  | "openai"
  | "fireworks"
  | "anthropic"
  | "google"
  | "groq"
  | "together"
  | "mistral"
  | "deepseek"
  | "openrouter"
  | "xai"
  | "perplexity"
  | "cohere"
  | "cerebras"
  | "sambanova"
  | "novita"
  | "hyperbolic"
  | "lepton"
  | "ai21"
  | "siliconflow"
  | "openai-compatible";

export interface ModelProviderPreset {
  id: ModelProviderId;
  label: string;
  baseUrl: string;
  defaultModel: string;
  envKey: string;
  docsUrl?: string;
}

export const MODEL_PROVIDER_PRESETS: Record<ModelProviderId, ModelProviderPreset> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1-mini",
    envKey: "OPENAI_API_KEY",
    docsUrl: "https://platform.openai.com/api-keys"
  },
  fireworks: {
    id: "fireworks",
    label: "Fireworks AI",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    defaultModel: "accounts/fireworks/models/deepseek-v4-pro",
    envKey: "FIREWORKS_API_KEY",
    docsUrl: "https://fireworks.ai/account/api-keys"
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-20250514",
    envKey: "ANTHROPIC_API_KEY",
    docsUrl: "https://console.anthropic.com/settings/keys"
  },
  google: {
    id: "google",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    envKey: "GOOGLE_API_KEY",
    docsUrl: "https://aistudio.google.com/apikey"
  },
  groq: {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    envKey: "GROQ_API_KEY",
    docsUrl: "https://console.groq.com/keys"
  },
  together: {
    id: "together",
    label: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    envKey: "TOGETHER_API_KEY",
    docsUrl: "https://api.together.ai/settings/api-keys"
  },
  mistral: {
    id: "mistral",
    label: "Mistral AI",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-latest",
    envKey: "MISTRAL_API_KEY",
    docsUrl: "https://console.mistral.ai/api-keys"
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    envKey: "DEEPSEEK_API_KEY",
    docsUrl: "https://platform.deepseek.com/api_keys"
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
    envKey: "OPENROUTER_API_KEY",
    docsUrl: "https://openrouter.ai/keys"
  },
  xai: {
    id: "xai",
    label: "xAI (Grok)",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-3-mini",
    envKey: "XAI_API_KEY",
    docsUrl: "https://console.x.ai"
  },
  perplexity: {
    id: "perplexity",
    label: "Perplexity",
    baseUrl: "https://api.perplexity.ai",
    defaultModel: "sonar",
    envKey: "PERPLEXITY_API_KEY",
    docsUrl: "https://www.perplexity.ai/settings/api"
  },
  cohere: {
    id: "cohere",
    label: "Cohere",
    baseUrl: "https://api.cohere.ai/v1",
    defaultModel: "command-r-plus",
    envKey: "COHERE_API_KEY",
    docsUrl: "https://dashboard.cohere.com/api-keys"
  },
  cerebras: {
    id: "cerebras",
    label: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    defaultModel: "llama-3.3-70b",
    envKey: "CEREBRAS_API_KEY",
    docsUrl: "https://cloud.cerebras.ai"
  },
  sambanova: {
    id: "sambanova",
    label: "SambaNova",
    baseUrl: "https://api.sambanova.ai/v1",
    defaultModel: "Meta-Llama-3.3-70B-Instruct",
    envKey: "SAMBANOVA_API_KEY",
    docsUrl: "https://cloud.sambanova.ai/apis"
  },
  novita: {
    id: "novita",
    label: "Novita AI",
    baseUrl: "https://api.novita.ai/v3/openai",
    defaultModel: "deepseek/deepseek-v3-0324",
    envKey: "NOVITA_API_KEY",
    docsUrl: "https://novita.ai/get-key"
  },
  hyperbolic: {
    id: "hyperbolic",
    label: "Hyperbolic",
    baseUrl: "https://api.hyperbolic.xyz/v1",
    defaultModel: "meta-llama/Meta-Llama-3.1-405B-Instruct",
    envKey: "HYPERBOLIC_API_KEY",
    docsUrl: "https://app.hyperbolic.xyz/settings"
  },
  lepton: {
    id: "lepton",
    label: "Lepton AI",
    baseUrl: "https://api.lepton.ai/api/v1",
    defaultModel: "gpt-4o-mini",
    envKey: "LEPTON_API_KEY",
    docsUrl: "https://www.lepton.ai/dashboard"
  },
  ai21: {
    id: "ai21",
    label: "AI21 Labs",
    baseUrl: "https://api.ai21.com/v1",
    defaultModel: "jamba-1.5-large",
    envKey: "AI21_API_KEY",
    docsUrl: "https://studio.ai21.com/account/api-key"
  },
  siliconflow: {
    id: "siliconflow",
    label: "SiliconFlow",
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "deepseek-ai/DeepSeek-V3",
    envKey: "SILICONFLOW_API_KEY",
    docsUrl: "https://cloud.siliconflow.cn/account/ak"
  },
  "openai-compatible": {
    id: "openai-compatible",
    label: "Custom (OpenAI-compatible)",
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
  private accumulatedUsage: TokenUsage = { promptTokens: 0, completionTokens: 0 };

  constructor(private readonly options: OpenAICompatibleOptions) {
    const preset = options.provider ? MODEL_PROVIDER_PRESETS[options.provider] : MODEL_PROVIDER_PRESETS.openai;
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? preset.baseUrl);
    this.model = options.model ?? preset.defaultModel;
  }

  getAccumulatedUsage(): TokenUsage {
    return { ...this.accumulatedUsage };
  }

  resetUsage(): void {
    this.accumulatedUsage = { promptTokens: 0, completionTokens: 0 };
  }

  private trackUsage(usage: TokenUsage): void {
    this.accumulatedUsage.promptTokens += usage.promptTokens;
    this.accumulatedUsage.completionTokens += usage.completionTokens;
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
      title: typeof parsed.title === "string" ? parsed.title : "",
      issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : []
    };
  }

  async generateCode(input: CodeGenInput): Promise<CodeGenResult> {
    const messages = buildCodeGenMessages(input);
    const stream = !!input.onChunk;

    if (!stream) {
      const content = await this.chat({ messages });
      return { code: content, usage: this.getAccumulatedUsage() };
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        stream: true,
        messages
      })
    });

    if (!response.ok) {
      throw new Error(`Model request failed with ${response.status}: ${await response.text()}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body stream.");

    const decoder = new TextDecoder();
    let fullContent = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            input.onChunk?.(delta);
          }
          if (parsed.usage) {
            this.trackUsage({
              promptTokens: parsed.usage.prompt_tokens ?? 0,
              completionTokens: parsed.usage.completion_tokens ?? 0
            });
          }
        } catch {
          // partial JSON, ignore
        }
      }
    }

    return { code: fullContent, usage: this.getAccumulatedUsage() };
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

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Model returned an empty response.");
    if (json.usage) {
      this.trackUsage({
        promptTokens: json.usage.prompt_tokens ?? 0,
        completionTokens: json.usage.completion_tokens ?? 0
      });
    }
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
  private accumulatedUsage: TokenUsage = { promptTokens: 0, completionTokens: 0 };

  getAccumulatedUsage(): TokenUsage {
    return { ...this.accumulatedUsage };
  }

  resetUsage(): void {
    this.accumulatedUsage = { promptTokens: 0, completionTokens: 0 };
  }

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
      return { answersGoal: false, answer: "No data was extracted from the page.", title: "Empty result", issues: ["empty_result"] };
    }
    const summary = entries.map(([key, value]) => `${key}: ${value}`).join(", ");
    return { answersGoal: true, answer: summary, title: input.goal.slice(0, 40), issues: [] };
  }

  async generateCode(input: CodeGenInput): Promise<CodeGenResult> {
    const code = generateHeuristicCode(input.manifest, input.language, input.includeDocs);
    return { code, usage: { promptTokens: 0, completionTokens: 0 } };
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
        ? { objective: normalizeObjective(ranking.objective), topK: typeof ranking.topK === "number" ? Math.min(ranking.topK, 100) : 20 }
        : undefined
    };
  }
  if (kind === "summary") {
    return { kind: "summary", fields: Array.isArray(obj.fields) ? obj.fields.map(String) : undefined };
  }
  return { kind: "fields", fields: Array.isArray(obj.fields) ? obj.fields.map(String) : undefined };
}

const OBJECTIVE_ALIASES: Record<string, string> = {
  "highest_price": "highest_price",
  "max_price": "highest_price",
  "most_expensive": "highest_price",
  "priciest": "highest_price",
  "lowest_price": "lowest_price",
  "min_price": "lowest_price",
  "cheapest": "lowest_price",
  "min_cost": "lowest_price",
  "highest_score": "highest_score",
  "max_score": "highest_score",
  "best_rated": "highest_score",
  "top_rated": "highest_score",
  "highest_rating": "highest_score",
  "lowest_score": "lowest_score",
  "min_score": "lowest_score",
  "worst_rated": "lowest_score",
  "relevance": "relevance",
  "relevant": "relevance",
  "most_relevant": "relevance",
  "newest": "newest",
  "latest": "newest",
  "most_recent": "newest",
  "oldest": "oldest",
  "earliest": "oldest",
  "none": "none",
  "no_ranking": "none",
  "": "none"
};

function normalizeObjective(raw: string): "lowest_price" | "highest_price" | "highest_score" | "lowest_score" | "relevance" | "newest" | "oldest" | "none" {
  const lower = raw.toLowerCase().trim();
  if (OBJECTIVE_ALIASES[lower]) return OBJECTIVE_ALIASES[lower] as any;
  if (lower.includes("price") || lower.includes("cost") || lower.includes("expensive") || lower.includes("cheap")) {
    return lower.includes("high") || lower.includes("max") || lower.includes("most") ? "highest_price" : "lowest_price";
  }
  if (lower.includes("score") || lower.includes("rating") || lower.includes("rated")) {
    return lower.includes("low") || lower.includes("min") || lower.includes("worst") ? "lowest_score" : "highest_score";
  }
  if (lower.includes("relevan") || lower.includes("match") || lower.includes("best")) return "relevance";
  if (lower.includes("new") || lower.includes("recent") || lower.includes("latest")) return "newest";
  if (lower.includes("old") || lower.includes("earliest")) return "oldest";
  return "none";
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
          ranking: { objective: "lowest_price | highest_price | highest_score | lowest_score | relevance | newest | oldest | none", topK: 20 }
        }
      })
    }
  ];
}

function buildGenerateMessages(input: GenerateManifestInput): Array<{ role: "system" | "user"; content: string }> {
  const hasStructuredData = input.structuredData && input.structuredData.length > 0;
  const hasOutline = input.outline && input.outline.length > 0;

  const context: Record<string, unknown> = {};

  if (hasStructuredData) {
    context.structuredData = input.structuredData!.map((block) => ({
      kind: block.kind,
      text: block.text.slice(0, 4000)
    }));
  }

  if (hasOutline) {
    context.domOutline = input.outline;
  }

  if (input.candidates && input.candidates.length > 0) {
    context.contentCandidates = input.candidates.slice(0, 30).map((c) => ({
      selector: c.selector,
      tag: c.tag,
      text: c.text.slice(0, 120),
      attributes: c.attributes
    }));
  }

  if (input.repeatedGroups && input.repeatedGroups.length > 0) {
    context.repeatedGroups = input.repeatedGroups.map((group) => ({
      selector: group.selector,
      count: group.count,
      fieldHints: group.fieldHints,
      sampleText: group.sampleTexts[0]?.slice(0, 300)
    }));
  }

  if (input.goalRelevantSections && input.goalRelevantSections.length > 0) {
    context.goalRelevantSections = input.goalRelevantSections.map((section) => ({
      selector: section.selector,
      matchedKeywords: section.matchedKeywords,
      text: section.text.slice(0, 300),
      html: section.html
    }));
  }

  if (!hasStructuredData && !hasOutline) {
    context.reducedHtml = input.html.slice(0, 45000);
  }

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
        pageContext: context,
        requiredShape: manifestShape(input.url, input.goal, input.strategy)
      })
    }
  ];
}

function buildRepairMessages(input: RepairManifestInput): Array<{ role: "system" | "user"; content: string }> {
  const failingFields = input.issues
    .filter((issue) => issue.field)
    .map((issue) => issue.field!)
    .filter(Boolean);

  const failingSelectors = failingFields
    .map((field) => {
      const rules = input.previousManifest.fields as Record<string, { selector?: string }> | undefined;
      const colRules = input.previousManifest.collections as Record<string, { selector?: string; fields?: Record<string, { selector?: string }> }> | undefined;
      if (rules?.[field]?.selector) return rules[field].selector!;
      for (const col of Object.values(colRules ?? {})) {
        if (col?.fields?.[field]?.selector) return col.fields[field].selector!;
      }
      return null;
    })
    .filter(Boolean) as string[];

  const context: Record<string, unknown> = {};

  if (failingSelectors.length > 0 && input.html) {
    context.failingSelectors = failingSelectors;
    context.targetedHtmlSections = failingSelectors.map((sel) => {
      const start = input.html.indexOf(sel.split(/[.#\[]/)[0]);
      if (start === -1) return null;
      return input.html.slice(Math.max(0, start - 500), Math.min(input.html.length, start + 4000));
    }).filter(Boolean);
  }

  if (input.outline) context.domOutline = input.outline;
  if (input.structuredData && input.structuredData.length > 0) {
    context.structuredData = input.structuredData.map((b) => ({ kind: b.kind, text: b.text.slice(0, 2000) }));
  }

  if (!context.targetedHtmlSections && !context.domOutline) {
    context.reducedHtml = input.html.slice(0, 30000);
  }

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
        pageContext: context,
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
          title: "short dialog title (3-6 words) in the user's language",
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
  "CRITICAL: Selectors are evaluated against static HTML using standard CSS selectors only.",
  "Do NOT use Playwright-specific pseudo-classes: :has-text, :text, :visible, :has, :not(:has-text), :is, :where.",
  "Do NOT use XPath or Playwright engine syntax. Only standard CSS3 selectors: tag, .class, #id, [attr], :nth-child, :first-child, :last-child, :not(), :empty, >, +, ~, :scope.",
  "You will receive page context in one or more of these formats:",
  "- domOutline: a compact tree of the DOM structure showing tags, classes, ids, and text samples for leaf nodes. Use this to understand page structure and find the right selectors.",
  "- structuredData: JSON-LD and meta tags from the page. Use these to understand field names and data types. Schema.org properties map to itemprop attributes in HTML.",
  "- contentCandidates: elements that likely contain the data, with selectors and text samples.",
  "- repeatedGroups: groups of similar elements (product cards, table rows, list items) with their selectors and sample text.",
  "- goalRelevantSections: HTML sections that contain text matching keywords from the user's goal. These are the most likely locations of the data you need. Pay close attention to these.",
  "- targetedHtmlSections: specific HTML snippets around failing selectors (for repair only).",
  "- reducedHtml: raw HTML fallback (only if outline is not available).",
  "Always prefer domOutline and structuredData over reducedHtml. They are more compact and reliable.",
  "Prefer stable selectors in this order: itemprop, data-testid/data-test, id, aria-label, semantic tags, then classes.",
  "Avoid random-looking CSS module, Tailwind utility, hashed, and framework-generated classes when possible.",
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
  "If the strategy is 'collection' and the user wants ranking, set ranking.objective accordingly:",
  "- 'lowest_price': user wants cheapest (cheapest, lowest price, дешевый).",
  "- 'highest_price': user wants most expensive (most expensive, highest price, дорогой).",
  "- 'highest_score': user wants best rated (best, top rated, highest rating, лучший по рейтингу).",
  "- 'lowest_score': user wants worst rated (worst, lowest rating).",
  "- 'relevance': user wants most relevant to the query.",
  "- 'newest': user wants most recent (newest, latest, recent, новейший).",
  "- 'oldest': user wants oldest (oldest, earliest, старейший).",
  "- 'none': no specific ranking needed.",
  "Use 'none' when no ranking is needed.",
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
  "3. Provide a short dialog title (3-6 words) that describes what was extracted. This title will be shown in the sidebar. Write it in the user's language.",
  "4. List any issues: missing fields, wrong values, empty results, or mismatches with the goal. Empty array if all good.",
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

const CODE_GEN_PROMPT = [
  "You generate executable scraping scripts from Parsewright manifests.",
  "The manifest contains CSS selectors, schema, and source configuration for a web page.",
  "Generate clean, production-ready code that uses the manifest to extract data from the page.",
  "If documentation is requested, include clear comments and a usage section.",
  "Do not include markdown code fences. Output only the raw code.",
  "The code must:",
  "- Fetch the page HTML (using requests/httpx for Python, fetch for JavaScript, curl for shell)",
  "- Apply the manifest selectors to extract fields",
  "- Handle errors gracefully",
  "- Print or return the extracted data as JSON"
].join("\n");

function buildCodeGenMessages(input: CodeGenInput): Array<{ role: "system" | "user"; content: string }> {
  const langName = input.language === "python" ? "Python" : input.language === "javascript" ? "JavaScript (Node.js)" : "Shell (curl + jq)";
  const libs = input.language === "python"
    ? "Use BeautifulSoup4 (bs4) for HTML parsing and requests for HTTP."
    : input.language === "javascript"
    ? "Use cheerio for HTML parsing and node-fetch for HTTP."
    : "Use curl for fetching and jq for parsing. Use grep/sed for CSS selector emulation where jq is insufficient.";

  return [
    { role: "system", content: CODE_GEN_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        task: "generate_extraction_script",
        language: langName,
        libraries: libs,
        includeDocs: input.includeDocs,
        extraRequirements: input.extraRequirements ?? undefined,
        manifest: input.manifest,
        fields: input.manifest.fields,
        collections: input.manifest.collections,
        source: input.manifest.source,
        schema: input.manifest.schema
      })
    }
  ];
}

function generateHeuristicCode(manifest: ParsewrightManifest, language: "python" | "javascript" | "curl", includeDocs: boolean): string {
  const url = manifest.source?.url ?? "https://example.com";
  const fields = manifest.fields ?? {};
  const collections = manifest.collections ?? {};

  if (language === "python") {
    const lines: string[] = [];
    if (includeDocs) {
      lines.push('"""');
      lines.push(`Parsewright extraction script for: ${manifest.goal ?? url}`);
      lines.push("");
      lines.push("Requirements: pip install requests beautifulsoup4");
      lines.push('"""');
      lines.push("");
    }
    lines.push("import requests");
    lines.push("from bs4 import BeautifulSoup");
    lines.push("import json");
    lines.push("");
    lines.push(`URL = "${url}"`);
    lines.push("");
    lines.push("response = requests.get(URL)");
    lines.push('soup = BeautifulSoup(response.text, "html.parser")');
    lines.push("");
    lines.push("result = {}");
    for (const [name, rule] of Object.entries(fields)) {
      lines.push(`result["${name}"] = soup.select_one("${rule.selector}")?.get_text(strip=True) if soup.select_one("${rule.selector}") else None`);
    }
    for (const [name, col] of Object.entries(collections)) {
      lines.push("");
      lines.push(`items_${name} = []`);
      lines.push(`for el in soup.select("${col.selector}"):`);
      const colFields = col.fields ?? {};
      if (Object.keys(colFields).length === 0) {
        lines.push(`    items_${name}.append(el.get_text(strip=True))`);
      } else {
        lines.push(`    item = {}`);
        for (const [fname, frule] of Object.entries(colFields)) {
          const sel = frule.selector === ":scope" ? "el" : `el.select_one("${frule.selector}")`;
          lines.push(`    item["${fname}"] = ${sel}.get_text(strip=True) if ${sel} else None`);
        }
        lines.push(`    items_${name}.append(item)`);
      }
      lines.push(`result["${name}"] = items_${name}`);
    }
    lines.push("");
    lines.push('print(json.dumps(result, ensure_ascii=False, indent=2))');
    return lines.join("\n");
  }

  if (language === "javascript") {
    const lines: string[] = [];
    if (includeDocs) {
      lines.push("// Parsewright extraction script");
      lines.push(`// Goal: ${manifest.goal ?? url}`);
      lines.push("// Requirements: npm install cheerio node-fetch");
      lines.push("");
    }
    lines.push('import fetch from "node-fetch";');
    lines.push('import * as cheerio from "cheerio";');
    lines.push("");
    lines.push(`const URL = "${url}";`);
    lines.push("");
    lines.push("async function extract() {");
    lines.push("  const response = await fetch(URL);");
    lines.push("  const html = await response.text();");
    lines.push("  const $ = cheerio.load(html);");
    lines.push("  const result = {};");
    for (const [name, rule] of Object.entries(fields)) {
      lines.push(`  result["${name}"] = $("${rule.selector}").first().text().trim() || null;`);
    }
    for (const [name, col] of Object.entries(collections)) {
      lines.push(`  result["${name}"] = []`);
      lines.push(`  $("${col.selector}").each((_, el) => {`);
      const colFields = col.fields ?? {};
      if (Object.keys(colFields).length === 0) {
        lines.push(`    result["${name}"].push($(el).text().trim());`);
      } else {
        lines.push(`    const item = {};`);
        for (const [fname, frule] of Object.entries(colFields)) {
          const sel = frule.selector === ":scope" ? "$(el)" : `$(el).find("${frule.selector}")`;
          lines.push(`    item["${fname}"] = ${sel}.text().trim() || null;`);
        }
        lines.push(`    result["${name}"].push(item);`);
      }
      lines.push(`  });`);
    }
    lines.push("  return result;");
    lines.push("}");
    lines.push("");
    lines.push("extract().then(r => console.log(JSON.stringify(r, null, 2)));");
    return lines.join("\n");
  }

  // curl
  const lines: string[] = [];
  if (includeDocs) {
    lines.push("# Parsewright extraction script (curl)");
    lines.push(`# Goal: ${manifest.goal ?? url}`);
    lines.push("# Requires: curl, jq, grep");
    lines.push("");
  }
  lines.push(`URL="${url}"`);
  lines.push('HTML=$(curl -s "$URL")');
  lines.push("");
  for (const [name, rule] of Object.entries(fields)) {
    lines.push(`# Extract ${name} using selector: ${rule.selector}`);
    lines.push(`${name}=$(echo "$HTML" | grep -oP '(?<=<[^>]*class="[^"]*")[^"]*' | head -1)`);
    lines.push("");
  }
  lines.push('echo "{\"url\": \"$URL\", \"status\": \"ok\"}" | jq .');
  return lines.join("\n");
}

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
