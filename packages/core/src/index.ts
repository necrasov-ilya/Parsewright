import type { PageCapture } from "@parsewright/capture";
import { runManifest } from "@parsewright/runner";
import { validateData, validatePage, type ValidationResult } from "@parsewright/validator";
import type { ModelGateway } from "@parsewright/model-gateway";
import type { ParsewrightManifest } from "@parsewright/manifest";

export interface CapturePort {
  capture(input: { url: string }): Promise<PageCapture>;
}

export interface ExtractOnceInput {
  url: string;
  goal: string;
}

export interface ExtractOnceResult {
  manifest: ParsewrightManifest;
  data: Record<string, unknown>;
  pageValidation: ValidationResult;
  dataValidation: ValidationResult;
  capture: PageCapture;
}

export async function extractOnce(input: ExtractOnceInput, ports: { capture: CapturePort; model: ModelGateway }): Promise<ExtractOnceResult> {
  const capture = await ports.capture.capture({ url: input.url });
  const pageValidation = validatePage({ html: capture.html, status: capture.status, finalUrl: capture.finalUrl });
  if (!pageValidation.ok) {
    throw Object.assign(new Error("Captured page failed sanity checks."), { pageValidation, capture });
  }

  const manifest = await ports.model.generateManifest({
    url: input.url,
    goal: input.goal,
    title: capture.title,
    html: capture.html
  });

  const data = runManifest({ manifest, html: capture.html });
  const dataValidation = validateData(manifest, data);

  return { manifest, data, pageValidation, dataValidation, capture };
}
