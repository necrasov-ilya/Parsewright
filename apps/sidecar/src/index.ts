import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { capturePage } from "@parsewright/capture";
import { extractUniversal } from "@parsewright/core";
import { createModelGateway, HeuristicGateway, listModelProviders, MODEL_PROVIDER_PRESETS, type ModelProviderId } from "@parsewright/model-gateway";
import { ParsewrightStorage, defaultDataDir, ensureDataDir } from "@parsewright/storage";

const port = Number(process.env.PARSEWRIGHT_SIDECAR_PORT ?? 47831);
const startedAt = new Date().toISOString();
const workspaceRoot = findWorkspaceRoot(process.cwd());
const sidecarVersion = "brain-v1";
const dataDir = process.env.PARSEWRIGHT_DATA_DIR ?? defaultDataDir();
await ensureDataDir(dataDir);
const storage = new ParsewrightStorage(dataDir);

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, DELETE, PATCH, OPTIONS",
        "access-control-allow-headers": "content-type"
      });
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, { ok: true, version: sidecarVersion, pid: process.pid, startedAt, workspaceRoot, dataDir });
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

    if (req.method === "GET" && req.url === "/dialogs") {
      return json(res, 200, { dialogs: storage.listDialogs() });
    }

    if (req.method === "GET" && req.url?.startsWith("/dialogs/")) {
      const id = Number(decodeURIComponent(req.url.slice("/dialogs/".length)));
      const dialog = storage.getDialog(id);
      if (!dialog) return json(res, 404, { error: "dialog_not_found" });
      return json(res, 200, { dialog });
    }

    if (req.method === "DELETE" && req.url?.startsWith("/dialogs/")) {
      const id = Number(decodeURIComponent(req.url.slice("/dialogs/".length)));
      storage.deleteDialog(id);
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && req.url === "/dialogs") {
      const body = await readJson(req);
      const id = storage.createDialog({
        title: body.title ?? body.goal ?? "New dialog",
        url: body.url,
        domain: extractDomain(body.url),
        faviconUrl: body.faviconUrl,
        accentColor: body.accentColor,
        goal: body.goal,
        answer: body.answer
      });
      return json(res, 200, { ok: true, id });
    }

    if (req.method === "PATCH" && req.url?.startsWith("/dialogs/")) {
      const id = Number(decodeURIComponent(req.url.slice("/dialogs/".length)));
      const body = await readJson(req);
      storage.updateDialog(id, {
        title: body.title,
        accentColor: body.accentColor,
        answer: body.answer
      });
      return json(res, 200, { ok: true });
    }

    if (req.method === "GET" && req.url === "/projects") {
      return json(res, 200, { projects: storage.listProjects() });
    }

    if (req.method === "GET" && req.url?.startsWith("/projects/")) {
      const id = decodeURIComponent(req.url.slice("/projects/".length));
      const project = storage.getProject(id);
      if (!project) return json(res, 404, { error: "project_not_found" });
      const runs = storage.listRuns(id);
      return json(res, 200, { project, runs });
    }

    if (req.method === "DELETE" && req.url?.startsWith("/projects/")) {
      const id = decodeURIComponent(req.url.slice("/projects/".length));
      storage.deleteProject(id);
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && req.url === "/save") {
      const body = await readJson(req);
      await storage.saveProjectFiles({
        manifest: body.manifest,
        result: body.result ?? {},
        snapshotHtml: body.snapshotHtml
      });
      storage.saveProject({
        manifest: body.manifest,
        result: body.result ?? {}
      });
      return json(res, 200, { ok: true, id: body.manifest.id });
    }

    if (req.method === "GET" && req.url?.startsWith("/runs/")) {
      const id = decodeURIComponent(req.url.slice("/runs/".length));
      return json(res, 200, { runs: storage.listRuns(id) });
    }

    if (req.method === "GET" && req.url === "/settings") {
      const keys = ["provider", "model", "baseUrl", "onboarding_complete", "use_heuristic"];
      const settings: Record<string, string> = {};
      for (const key of keys) {
        const value = storage.getSetting(key);
        if (value) settings[key] = value;
      }
      return json(res, 200, { settings });
    }

    if (req.method === "POST" && req.url === "/settings") {
      const body = await readJson(req);
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === "string") storage.setSetting(key, value);
      }
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && req.url === "/reset") {
      storage.reset();
      return json(res, 200, { ok: true });
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

      const runStartedAt = new Date().toISOString();
      const runStart = Date.now();

      try {
        const result = await extractUniversal(
          { url: body.url, goal: body.goal, maxItems: body.maxItems, mode: body.mode ?? "auto" },
          { capture: { capture: ({ url }) => capturePage({ url }) }, model }
        );

        const dialogId = storage.createDialog({
          title: result.verification.title || body.goal.slice(0, 60),
          url: body.url,
          domain: extractDomain(body.url),
          faviconUrl: result.capture.favicon,
          goal: body.goal,
          answer: result.answer
        });

        storage.recordRun({
          startedAt: runStartedAt,
          durationMs: Date.now() - runStart,
          success: true,
          answer: result.answer,
          data: result.data,
          validation: result.validation,
          repaired: result.repaired,
          issues: result.verification.issues
        });

        return json(res, 200, { ...result, dialogId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        storage.recordRun({
          startedAt: runStartedAt,
          durationMs: Date.now() - runStart,
          success: false,
          issues: [errorMessage]
        });
        throw error;
      }
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
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, DELETE, PATCH, OPTIONS",
    "access-control-allow-headers": "content-type"
  });
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
  if (value in MODEL_PROVIDER_PRESETS) return value as ModelProviderId;
  throw new Error(`Unknown provider "${value}".`);
}

function providerApiKey(provider: ModelProviderId): string | undefined {
  return process.env[MODEL_PROVIDER_PRESETS[provider].envKey];
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
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
