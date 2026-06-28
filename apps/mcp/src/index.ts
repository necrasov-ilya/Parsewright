import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { capturePage } from "@parsewright/capture";
import { extractOnce } from "@parsewright/core";
import { HeuristicGateway, OpenAICompatibleGateway } from "@parsewright/model-gateway";

const server = new McpServer({ name: "parsewright", version: "0.0.0" });

server.tool(
  "extract_once",
  {
    url: z.string().url(),
    goal: z.string().min(1),
    heuristic: z.boolean().optional()
  },
  async ({ url, goal, heuristic }) => {
    const model = heuristic
      ? new HeuristicGateway()
      : new OpenAICompatibleGateway({
          apiKey: requireKey(process.env.OPENAI_API_KEY),
          baseUrl: process.env.OPENAI_BASE_URL,
          model: process.env.OPENAI_MODEL
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
