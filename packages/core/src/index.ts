import type { PageCapture } from "@parsewright/capture";
import { applyClassificationPatches, classifyCandidates, type ClassifiedCandidate } from "@parsewright/classifier";
import { runManifest } from "@parsewright/runner";
import { validateData, validatePage, type ValidationResult } from "@parsewright/validator";
import type { ModelGateway, VerifyAndComposeResult } from "@parsewright/model-gateway";
import type { ExtractionStrategy, ParsewrightManifest } from "@parsewright/manifest";
import { reducePage, type PageContext } from "@parsewright/page-reducer";
import { normalizeExtraction, type NormalizedCandidate } from "@parsewright/normalizer";
import { rankCandidates, type RankingResult } from "@parsewright/ranker";

export interface CapturePort {
  capture(input: { url: string }): Promise<PageCapture>;
}

export interface ExtractOnceInput {
  url: string;
  goal: string;
  repair?: boolean;
  maxItems?: number;
  mode?: "auto";
}

export interface UniversalExtractResult {
  strategy: ExtractionStrategy;
  manifest: ParsewrightManifest;
  data: Record<string, unknown>;
  answer: string;
  table: Array<Record<string, unknown>>;
  bestItem?: ClassifiedCandidate;
  verification: VerifyAndComposeResult;
  artifact: {
    strategy: ExtractionStrategy;
    normalizationPlan: { maxItems: number };
    rankingPlan: ExtractionStrategy["ranking"];
    paginationPlan: { maxPages: number; visitedUrls: string[] };
  };
  validation: {
    page: ValidationResult;
    data: ValidationResult;
  };
  capture: Pick<PageCapture, "url" | "finalUrl" | "status" | "title" | "baseUrl" | "favicon" | "timingMs" | "capturedAt">;
  pageContext: PageContext;
  normalizedCandidates: NormalizedCandidate[];
  classifiedCandidates: ClassifiedCandidate[];
  repaired: boolean;
}

export async function extractUniversal(input: ExtractOnceInput, ports: { capture: CapturePort; model: ModelGateway }): Promise<UniversalExtractResult> {
  const capture = await ports.capture.capture({ url: input.url });
  const pageValidation = validatePage({ html: capture.html, status: capture.status, finalUrl: capture.finalUrl });
  if (!pageValidation.ok) {
    const issueSummary = pageValidation.issues.map((issue) => `${issue.code}: ${issue.message}`).join("; ");
    throw Object.assign(new Error(`Captured page failed sanity checks: ${issueSummary}`), { pageValidation, capture });
  }

  const pageContext = reducePage(capture.html, { maxHtmlChars: 45000, maxTextChars: 12000, maxCandidates: 80 });

  const strategy = await ports.model.planStrategy({
    url: input.url,
    goal: input.goal,
    title: capture.title,
    pageContext
  });

  let manifest = await ports.model.generateManifest({
    url: input.url,
    goal: input.goal,
    strategy,
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
      strategy,
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

  let normalizedCandidates: NormalizedCandidate[] = [];
  let classifiedCandidates: ClassifiedCandidate[] = [];
  let ranking: RankingResult | undefined;
  const table: Array<Record<string, unknown>> = [];

  if (strategy.kind === "collection") {
    normalizedCandidates = normalizeExtraction({
      data,
      baseUrl: capture.finalUrl,
      maxItems: input.maxItems ?? 2000
    });

    const objective = strategy.ranking?.objective ?? "none";
    if (objective !== "none") {
      ranking = rankCandidates(normalizedCandidates, input.goal, strategy);
      classifiedCandidates = classifyCandidates(ranking.ranked);

      if (ports.model.classifyCandidates && classifiedCandidates.length > 0) {
        const patches = await ports.model.classifyCandidates({
          goal: input.goal,
          candidates: classifiedCandidates.slice(0, 30).map((candidate) => ({
            id: candidate.id,
            title: candidate.title,
            fullText: candidate.fullText,
            price: candidate.price,
            currency: candidate.currency,
            seller: candidate.seller,
            url: candidate.url
          }))
        });
        classifiedCandidates = applyClassificationPatches(classifiedCandidates, patches);
      }

      for (const candidate of classifiedCandidates) {
        table.push({
          rank: candidate.rank,
          title: candidate.title,
          price: candidate.price,
          currency: candidate.currency,
          seller: candidate.seller,
          url: candidate.url,
          confidence: candidate.confidence,
          reason: candidate.classificationReason
        });
      }
    } else {
      for (const candidate of normalizedCandidates) {
        table.push(candidate.raw);
      }
    }
  }

  const verification = await ports.model.verifyAndCompose({
    goal: input.goal,
    strategy,
    data,
    candidates: strategy.kind === "collection" ? table : undefined,
    pageTitle: capture.title
  });

  return {
    strategy,
    manifest,
    data,
    answer: verification.answer,
    table,
    bestItem: classifiedCandidates[0],
    verification,
    artifact: {
      strategy,
      normalizationPlan: { maxItems: input.maxItems ?? 2000 },
      rankingPlan: strategy.ranking,
      paginationPlan: { maxPages: 1, visitedUrls: [capture.finalUrl] }
    },
    validation: {
      page: pageValidation,
      data: dataValidation
    },
    capture: {
      url: capture.url,
      finalUrl: capture.finalUrl,
      status: capture.status,
      title: capture.title,
      baseUrl: capture.baseUrl,
      favicon: capture.favicon,
      timingMs: capture.timingMs,
      capturedAt: capture.capturedAt
    },
    pageContext,
    normalizedCandidates,
    classifiedCandidates,
    repaired
  };
}

export async function extractOnce(input: ExtractOnceInput, ports: { capture: CapturePort; model: ModelGateway }): Promise<UniversalExtractResult> {
  return extractUniversal(input, ports);
}
