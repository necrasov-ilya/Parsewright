import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { capturePage } from "@parsewright/capture";
import { extractOnce } from "@parsewright/core";
import { createModelGateway, HeuristicGateway, MODEL_PROVIDER_PRESETS, type ModelProviderId } from "@parsewright/model-gateway";

const server = new McpServer({ name: "parsewright", version: "0.0.0" });

server.tool(
  "extract_once",
  {
    url: z.string().url(),
    goal: z.string().min(1),
    provider: z.enum(["openai", "fireworks", "openai-compatible"]).optional(),
    heuristic: z.boolean().optional()
  },
  async ({ url, goal, provider, heuristic }) => {
    const selectedProvider = provider ?? parseProvider(process.env.PARSEWRIGHT_PROVIDER ?? "openai");
    const model = heuristic
      ? new HeuristicGateway()
      : createModelGateway({
          provider: selectedProvider,
          apiKey: requireKey(providerApiKey(selectedProvider)),
          baseUrl: process.env.PARSEWRIGHT_BASE_URL,
          model: process.env.PARSEWRIGHT_MODEL
        });

    const result = await extractOnce({ url, goal }, { capture: { capture: ({ url: target }) => capturePage({ url: target }) }, model });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ data: result.data, validation: result.dataValidation, manifest: result.manifest }, null, 2)
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
  if (value === "openai" || value === "fireworks" || value === "openai-compatible") return value;
  throw new Error(`Unknown provider "${value}".`);
}

function providerApiKey(provider: ModelProviderId): string | undefined {
  return process.env[MODEL_PROVIDER_PRESETS[provider].envKey];
}
