#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { capturePage } from "@parsewright/capture";
import { extractOnce } from "@parsewright/core";
import { parseManifest } from "@parsewright/manifest";
import { createModelGateway, HeuristicGateway, MODEL_PROVIDER_PRESETS, type ModelProviderId } from "@parsewright/model-gateway";
import { runManifest } from "@parsewright/runner";
import { saveProject } from "@parsewright/storage";
import { validateData, validatePage } from "@parsewright/validator";

const program = new Command();

program.name("parsewright").description("Create and run reusable website extraction artifacts.");

program
  .command("extract")
  .requiredOption("--url <url>")
  .requiredOption("--goal <goal>")
  .option("--save <dir>")
  .option("--api-key <key>", "OpenAI-compatible API key", process.env.OPENAI_API_KEY)
  .option("--provider <provider>", "Model provider preset: openai, fireworks, openai-compatible", process.env.PARSEWRIGHT_PROVIDER ?? "openai")
  .option("--base-url <url>", "OpenAI-compatible base URL")
  .option("--model <model>", "Model name")
  .option("--heuristic", "Use a local heuristic manifest generator for smoke tests")
  .action(async (options) => {
    const model = options.heuristic
      ? new HeuristicGateway()
      : createModelGateway({
          provider: parseProvider(options.provider),
          apiKey: requireKey(options.apiKey ?? providerApiKey(parseProvider(options.provider))),
          baseUrl: options.baseUrl ?? process.env.PARSEWRIGHT_BASE_URL,
          model: options.model ?? process.env.PARSEWRIGHT_MODEL
        });

    const result = await extractOnce(
      { url: options.url, goal: options.goal },
      { capture: { capture: ({ url }) => capturePage({ url }) }, model }
    );

    if (options.save) {
      await saveProject({
        rootDir: path.resolve(options.save),
        manifest: result.manifest,
        result: result.data,
        snapshotHtml: result.capture.html
      });
    }

    console.log(JSON.stringify({ data: result.data, validation: result.dataValidation, manifest: result.manifest }, null, 2));
  });

program
  .command("run")
  .requiredOption("--manifest <file>")
  .option("--html <file>")
  .option("--url <url>")
  .action(async (options) => {
    const manifest = parseManifest(JSON.parse(await readFile(options.manifest, "utf8")));
    const html = options.html ? await readFile(options.html, "utf8") : (await capturePage({ url: options.url ?? manifest.source.url, wait: manifest.source.wait })).html;
    const pageValidation = validatePage({ html });
    if (!pageValidation.ok) throw new Error(`Page sanity failed: ${JSON.stringify(pageValidation.issues)}`);
    const data = runManifest({ manifest, html });
    const dataValidation = validateData(manifest, data);
    console.log(JSON.stringify({ data, validation: dataValidation }, null, 2));
  });

program.parseAsync().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

function requireKey(key?: string): string {
  if (!key) throw new Error("Missing API key. Set OPENAI_API_KEY, pass --api-key, or use --heuristic for smoke tests.");
  return key;
}

function parseProvider(value: string): ModelProviderId {
  if (value === "openai" || value === "fireworks" || value === "openai-compatible") return value;
  throw new Error(`Unknown provider "${value}". Use openai, fireworks, or openai-compatible.`);
}

function providerApiKey(provider: ModelProviderId): string | undefined {
  return process.env[MODEL_PROVIDER_PRESETS[provider].envKey];
}
