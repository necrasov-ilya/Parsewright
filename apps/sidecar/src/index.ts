import http from "node:http";
import { capturePage } from "@parsewright/capture";
import { extractOnce } from "@parsewright/core";
import { HeuristicGateway, OpenAICompatibleGateway } from "@parsewright/model-gateway";

const port = Number(process.env.PARSEWRIGHT_SIDECAR_PORT ?? 47831);

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && req.url === "/extract") {
      const body = await readJson(req);
      const model = body.heuristic
        ? new HeuristicGateway()
        : new OpenAICompatibleGateway({
            apiKey: requireKey(process.env.OPENAI_API_KEY),
            baseUrl: process.env.OPENAI_BASE_URL,
            model: process.env.OPENAI_MODEL
          });
      const result = await extractOnce(
        { url: body.url, goal: body.goal },
        { capture: { capture: ({ url }) => capturePage({ url }) }, model }
      );
      return json(res, 200, { data: result.data, validation: result.dataValidation, manifest: result.manifest });
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
