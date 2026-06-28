import { createManifestId, ParsewrightManifestSchema, type ParsewrightManifest } from "@parsewright/manifest";

export interface ModelGateway {
  generateManifest(input: GenerateManifestInput): Promise<ParsewrightManifest>;
}

export interface GenerateManifestInput {
  url: string;
  goal: string;
  title?: string;
  html: string;
}

export interface OpenAICompatibleOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export class OpenAICompatibleGateway implements ModelGateway {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(private readonly options: OpenAICompatibleOptions) {
    this.baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
    this.model = options.model ?? "gpt-4.1-mini";
  }

  async generateManifest(input: GenerateManifestInput): Promise<ParsewrightManifest> {
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
        messages: [
          {
            role: "system",
            content:
              "You create Parsewright manifests. Return only JSON. Prefer simple CSS selectors, text extraction, and trim/number/price transforms. Use version 0.1."
          },
          {
            role: "user",
            content: JSON.stringify({
              url: input.url,
              goal: input.goal,
              title: input.title,
              html: input.html.slice(0, 60000),
              requiredShape: {
                version: "0.1",
                id: "string",
                name: "string",
                goal: input.goal,
                source: { url: input.url, wait: { kind: "selector_or_timeout", timeoutMs: 10000, settleMs: 500 } },
                schema: { fieldName: { type: "string|number|boolean|array|object", required: true, nullable: false, maxLength: 500 } },
                fields: { fieldName: { selector: "css selector", attribute: "optional", multiple: false, transforms: ["trim"] } },
                license: "MIT"
              }
            })
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Model request failed with ${response.status}: ${await response.text()}`);
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Model returned an empty manifest response.");

    const manifest = ParsewrightManifestSchema.parse(JSON.parse(content));
    return {
      ...manifest,
      id: manifest.id || createManifestId(input.url, input.goal),
      source: {
        ...manifest.source,
        url: input.url
      },
      goal: input.goal
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
      license: "MIT",
      createdAt: new Date().toISOString()
    };
  }
}
