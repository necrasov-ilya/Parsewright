import { createManifestId, ParsewrightManifestSchema, type ParsewrightManifest } from "@parsewright/manifest";
import type { PageContext } from "@parsewright/page-reducer";

export interface ModelGateway {
  generateManifest(input: GenerateManifestInput): Promise<ParsewrightManifest>;
  repairManifest?(input: RepairManifestInput): Promise<ParsewrightManifest>;
}

export interface GenerateManifestInput {
  url: string;
  goal: string;
  title?: string;
  html: string;
  pageContext?: PageContext;
}

export interface RepairManifestInput extends GenerateManifestInput {
  previousManifest: ParsewrightManifest;
  data?: Record<string, unknown>;
  issues: Array<{ field?: string; code: string; message: string }>;
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

  async generateManifest(input: GenerateManifestInput): Promise<ParsewrightManifest> {
    return this.requestManifest(buildGenerateMessages(input), input.url, input.goal);
  }

  async repairManifest(input: RepairManifestInput): Promise<ParsewrightManifest> {
    return this.requestManifest(buildRepairMessages(input), input.url, input.goal);
  }

  private async requestManifest(messages: Array<{ role: "system" | "user"; content: string }>, url: string, goal: string): Promise<ParsewrightManifest> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages
      })
    });

    if (!response.ok) {
      throw new Error(`Model request failed with ${response.status}: ${await response.text()}`);
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Model returned an empty manifest response.");

    const manifest = ParsewrightManifestSchema.parse(normalizeManifestJson(JSON.parse(content)));
    return {
      ...manifest,
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
  async generateManifest(input: GenerateManifestInput): Promise<ParsewrightManifest> {
    const id = createManifestId(input.url, input.goal);
    const fields = input.goal
      .split(/[,;\n]+/)
      .map((field) => field.trim().toLowerCase().replace(/[^a-z0-9_ -]/g, "").replace(/\s+/g, "_"))
      .filter(Boolean);

    const schema = Object.fromEntries(fields.map((field) => [field, { type: "string" as const, required: true, nullable: false, maxLength: 500 }]));
    const rules = Object.fromEntries(fields.map((field) => [field, { selector: field.includes("title") ? "h1" : "body", multiple: false, transforms: ["trim" as const] }]));

    return {
      version: "0.1",
      id,
      name: id,
      goal: input.goal,
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
        pageTitle: input.title,
        pageContext: input.pageContext ?? {
          reducedHtml: input.html.slice(0, 45000)
        },
        requiredShape: manifestShape(input.url, input.goal)
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
        pageTitle: input.title,
        previousManifest: input.previousManifest,
        previousData: input.data,
        validationIssues: input.issues,
        pageContext: input.pageContext ?? {
          reducedHtml: input.html.slice(0, 45000)
        },
        requiredShape: manifestShape(input.url, input.goal)
      })
    }
  ];
}

const SYSTEM_PROMPT = [
  "You generate deterministic Parsewright manifests for web data extraction.",
  "Return only valid JSON. No markdown. No commentary.",
  "The manifest must match the provided shape exactly.",
  "Prefer stable selectors in this order: itemprop, data-testid/data-test, id, aria-label, semantic tags, then classes.",
  "Avoid random-looking CSS module, Tailwind utility, hashed, and framework-generated classes when possible.",
  "Use JSON-LD/meta context to understand the page, but v0 manifest fields must use CSS selectors against HTML.",
  "Every requested user field must appear in both schema and fields.",
  "When the user asks for best, cheapest, top, products, listings, offers, rows, prices, search results, or anything that requires comparing repeated items, create a collection and put one row per repeated item there.",
  "Collections must use a stable item selector and field selectors relative to that item. Use :scope when extracting text or attributes from the item itself.",
  "Use type number only when a numeric transform can reliably convert the extracted text.",
  "Use transforms only from this list: trim, number, price, lowercase, uppercase.",
  "Use multiple=true only for list fields.",
  "Use maxLength 500 for ordinary strings and 2000 for descriptions or arrays represented as text.",
  "Set source.wait.kind to selector_or_timeout and selector to the strongest selector needed for the page content."
].join("\n");

function manifestShape(url: string, goal: string) {
  const id = createManifestId(url, goal);
  return {
    version: "0.1",
    id,
    name: id,
    goal,
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
