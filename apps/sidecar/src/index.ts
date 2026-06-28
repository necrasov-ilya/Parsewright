import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { capturePage } from "@parsewright/capture";
import { extractUniversal } from "@parsewright/core";
import { createModelGateway, HeuristicGateway, listModelProviders, MODEL_PROVIDER_PRESETS, type ModelProviderId } from "@parsewright/model-gateway";

const port = Number(process.env.PARSEWRIGHT_SIDECAR_PORT ?? 47831);
const startedAt = new Date().toISOString();
const workspaceRoot = findWorkspaceRoot(process.cwd());
const sidecarVersion = "brain-v1";

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, { ok: true, version: sidecarVersion, pid: process.pid, startedAt, workspaceRoot });
    }

    if (req.method === "GET" && req.url === "/providers") {
      return json(res, 200, {
        providers: listModelProviders().map((provider) => ({
          id: provider.id,
          label: provider.label,
          defaultModel: provider.defaultModel,
          configurableBaseUrl: provider.id === "openai-compatible"
        }))
      });
    }

    if (req.method === "POST" && req.url === "/extract") {
      const body = await readJson(req);
      const model = body.heuristic
        ? new HeuristicGateway()
          : createModelGateway({
            provider: parseProvider(body.provider ?? process.env.PARSEWRIGHT_PROVIDER ?? "openai-compatible"),
            apiKey: requireKey(nonEmpty(body.apiKey) ?? providerApiKey(parseProvider(body.provider ?? process.env.PARSEWRIGHT_PROVIDER ?? "openai-compatible"))),
            baseUrl: nonEmpty(body.baseUrl) ?? process.env.PARSEWRIGHT_BASE_URL,
            model: nonEmpty(body.model) ?? process.env.PARSEWRIGHT_MODEL
          });
      const result = await extractUniversal(
        { url: body.url, goal: body.goal, maxItems: body.maxItems, mode: body.mode ?? "auto" },
        { capture: { capture: ({ url }) => capturePage({ url }) }, model }
      );
      return json(res, 200, result);
    }

    return json(res, 404, { error: "not_found" });
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Parsewright sidecar listening on http://127.0.0.1:${port}`);
});

function json(res: http.ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}

function readJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function requireKey(key?: string): string {
  if (!key) throw new Error("Missing OPENAI_API_KEY. Enable heuristic mode or configure a key.");
  return key;
}

function parseProvider(value: string): ModelProviderId {
  if (value === "openai" || value === "fireworks" || value === "openai-compatible") return value;
  throw new Error(`Unknown provider "${value}".`);
}

function providerApiKey(provider: ModelProviderId): string | undefined {
  return process.env[MODEL_PROVIDER_PRESETS[provider].envKey];
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function findWorkspaceRoot(start: string): string {
  let current = start;
  while (true) {
    if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return start;
    current = parent;
  }
}
