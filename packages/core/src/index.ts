import type { PageCapture } from "@parsewright/capture";
import { runManifest } from "@parsewright/runner";
import { validateData, validatePage, type ValidationResult } from "@parsewright/validator";
import type { ModelGateway } from "@parsewright/model-gateway";
import type { ParsewrightManifest } from "@parsewright/manifest";
import { reducePage, type PageContext } from "@parsewright/page-reducer";

export interface CapturePort {
  capture(input: { url: string }): Promise<PageCapture>;
}

export interface ExtractOnceInput {
  url: string;
  goal: string;
  repair?: boolean;
}

export interface ExtractOnceResult {
  manifest: ParsewrightManifest;
  data: Record<string, unknown>;
  pageValidation: ValidationResult;
  dataValidation: ValidationResult;
  capture: PageCapture;
  pageContext: PageContext;
  repaired: boolean;
}

export async function extractOnce(input: ExtractOnceInput, ports: { capture: CapturePort; model: ModelGateway }): Promise<ExtractOnceResult> {
  const capture = await ports.capture.capture({ url: input.url });
  const pageValidation = validatePage({ html: capture.html, status: capture.status, finalUrl: capture.finalUrl });
  if (!pageValidation.ok) {
    throw Object.assign(new Error("Captured page failed sanity checks."), { pageValidation, capture });
  }

  const pageContext = reducePage(capture.html, { maxHtmlChars: 45000, maxTextChars: 12000, maxCandidates: 80 });

  let manifest = await ports.model.generateManifest({
    url: input.url,
    goal: input.goal,
    title: capture.title,
    html: capture.html,
    pageContext
  });

  let data = runManifest({ manifest, html: capture.html });
  let dataValidation = validateData(manifest, data);
  let repaired = false;

  if (!dataValidation.ok && input.repair !== false && ports.model.repairManifest) {
    const repairedManifest = await ports.model.repairManifest({
      url: input.url,
      goal: input.goal,
      title: capture.title,
      html: capture.html,
      pageContext,
      previousManifest: manifest,
      data,
      issues: dataValidation.issues
    });

    const repairedData = runManifest({ manifest: repairedManifest, html: capture.html });
    const repairedValidation = validateData(repairedManifest, repairedData);
    if (repairedValidation.ok) {
      manifest = repairedManifest;
      data = repairedData;
      dataValidation = repairedValidation;
      repaired = true;
    }
  }

  return { manifest, data, pageValidation, dataValidation, capture, pageContext, repaired };
}
