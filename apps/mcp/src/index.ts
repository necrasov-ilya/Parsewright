import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { capturePage } from "@parsewright/capture";
import { extractUniversal } from "@parsewright/core";
import { createModelGateway, HeuristicGateway, MODEL_PROVIDER_PRESETS, type ModelProviderId } from "@parsewright/model-gateway";

const server = new McpServer({ name: "parsewright", version: "0.0.0" });

server.tool(
  "extract_once",
  {
    url: z.string().url(),
    goal: z.string().min(1),
    provider: z.string().optional(),
    heuristic: z.boolean().optional()
  },
  async ({ url, goal, provider, heuristic }) => {
    const selectedProvider = parseProvider(provider ?? process.env.PARSEWRIGHT_PROVIDER ?? "openai");
    const model = heuristic
      ? new HeuristicGateway()
      : createModelGateway({
          provider: selectedProvider,
          apiKey: requireKey(providerApiKey(selectedProvider)),
          baseUrl: process.env.PARSEWRIGHT_BASE_URL,
          model: process.env.PARSEWRIGHT_MODEL
        });

    const result = await extractUniversal(
      { url, goal },
      { capture: { capture: ({ url: target }) => capturePage({ url: target }) }, model }
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            answer: result.answer,
            data: result.data,
            strategy: result.strategy,
            table: result.table,
            verification: result.verification,
            validation: result.validation,
            manifest: result.manifest
          }, null, 2)
        }
      ]
    };
  }
);

await server.connect(new StdioServerTransport());

function requireKey(key?: string): string {
  if (!key) throw new Error("Missing OPENAI_API_KEY. Set it or pass heuristic=true for smoke tests.");
  return key;
}

function parseProvider(value: string): ModelProviderId {
  if (value in MODEL_PROVIDER_PRESETS) return value as ModelProviderId;
  throw new Error(`Unknown provider "${value}".`);
}

function providerApiKey(provider: ModelProviderId): string | undefined {
  return process.env[MODEL_PROVIDER_PRESETS[provider].envKey];
}
