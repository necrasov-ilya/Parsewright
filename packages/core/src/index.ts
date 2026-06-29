import type { PageCapture } from "@parsewright/capture";
import { applyClassificationPatches, classifyCandidates, type ClassifiedCandidate } from "@parsewright/classifier";
import { runManifest } from "@parsewright/runner";
import { validateData, validatePage, type ValidationResult } from "@parsewright/validator";
import type { ModelGateway, TokenUsage, VerifyAndComposeResult } from "@parsewright/model-gateway";
import type { ExtractionStrategy, ParsewrightManifest } from "@parsewright/manifest";
import { reducePage, findGoalRelevantSections, type PageContext } from "@parsewright/page-reducer";
import { normalizeExtraction, type NormalizedCandidate } from "@parsewright/normalizer";
import { rankCandidates, type RankingResult } from "@parsewright/ranker";

export interface CapturePort {
  capture(input: { url: string }): Promise<PageCapture>;
}

export type PipelineStage =
  | "capture"
  | "page_reduction"
  | "strategy"
  | "manifest"
  | "runner"
  | "validation"
  | "repair"
  | "ranking"
  | "verify"
  | "done";

export interface PipelineEvent {
  stage: PipelineStage;
  status: "start" | "done" | "error";
  tool?: string;
  toolLabel?: string;
  thinking?: string;
  data?: unknown;
  usage?: TokenUsage;
}

export type StageCallback = (event: PipelineEvent) => void;

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
  usage: TokenUsage;
}

export interface ManifestCachePort {
  get(url: string, goal: string): ParsewrightManifest | undefined;
  set(url: string, goal: string, manifest: ParsewrightManifest): void;
}

export interface ExtractPorts {
  capture: CapturePort;
  model: ModelGateway;
  onStage?: StageCallback;
  manifestCache?: ManifestCachePort;
}

export async function extractUniversal(input: ExtractOnceInput, ports: ExtractPorts): Promise<UniversalExtractResult> {
  const { onStage, manifestCache } = ports;
  ports.model.resetUsage();

  onStage?.({ stage: "capture", status: "start", tool: "Playwright", toolLabel: "Открываю страницу", thinking: "Сперва мне нужно посмотреть страницу…" });

  const capture = await ports.capture.capture({ url: input.url });
  const pageValidation = validatePage({ html: capture.html, status: capture.status, finalUrl: capture.finalUrl });
  if (!pageValidation.ok) {
    const issueSummary = pageValidation.issues.map((issue) => `${issue.code}: ${issue.message}`).join("; ");
    onStage?.({ stage: "capture", status: "error", tool: "Playwright", data: { issues: pageValidation.issues } });
    throw Object.assign(new Error(`Captured page failed sanity checks: ${issueSummary}`), { pageValidation, capture });
  }

  onStage?.({
    stage: "capture", status: "done", tool: "Playwright",
    data: { url: capture.url, finalUrl: capture.finalUrl, status: capture.status, title: capture.title, favicon: capture.favicon, timingMs: capture.timingMs }
  });

  onStage?.({ stage: "page_reduction", status: "start", tool: "Page Reducer", toolLabel: "Анализирую структуру", thinking: "Изучу структуру страницы и текст…" });

  const pageContext = reducePage(capture.html, { maxHtmlChars: 45000, maxTextChars: 12000, maxCandidates: 80 });
  const goalRelevantSections = findGoalRelevantSections(capture.html, input.goal);

  onStage?.({ stage: "page_reduction", status: "done", tool: "Page Reducer", data: { groupsFound: pageContext.repeatedGroups.length, relevantSections: goalRelevantSections.length } });

  let strategy: ExtractionStrategy;
  let manifest: ParsewrightManifest;
  let data: Record<string, unknown>;
  let dataValidation: ValidationResult;
  let repaired = false;
  let usedCache = false;

  const cachedManifest = manifestCache?.get(input.url, input.goal);

  if (cachedManifest) {
    onStage?.({ stage: "runner", status: "start", tool: "Runner", toolLabel: "Применяю алгоритм", thinking: "У меня уже есть алгоритм для этой страницы. Проверю, работает ли он…" });

    const cachedData = runManifest({ manifest: cachedManifest, html: capture.html });
    const cachedValidation = validateData(cachedManifest, cachedData);

    if (cachedValidation.ok && hasNonEmptyData(cachedData)) {
      strategy = cachedManifest.strategy ?? { kind: "fields" };
      manifest = cachedManifest;
      data = cachedData;
      dataValidation = cachedValidation;
      usedCache = true;

      onStage?.({ stage: "runner", status: "done", tool: "Runner", data: { fieldsExtracted: Object.keys(data).length, cached: true } });
      onStage?.({ stage: "validation", status: "done", tool: "Validator", data: { ok: true, cached: true } });
    } else {
      onStage?.({ stage: "runner", status: "done", tool: "Runner", data: { fieldsExtracted: 0, cached: false, reason: "stale" } });
      onStage?.({ stage: "validation", status: "start", tool: "Validator", toolLabel: "Проверяю результат", thinking: "Алгоритм устарел. Составлю новый…" });
    }
  }

  if (!usedCache) {
    onStage?.({ stage: "strategy", status: "start", tool: "Model", toolLabel: "Планирую стратегию", thinking: "Понял задачу. Определяю стратегию извлечения…" });

    strategy = await ports.model.planStrategy({
      url: input.url,
      goal: input.goal,
      title: capture.title,
      pageContext
    });

    onStage?.({ stage: "strategy", status: "done", tool: "Model", data: strategy, usage: ports.model.getAccumulatedUsage() });

  const strategyDesc = strategy.kind === "collection"
    ? strategy.ranking?.objective && strategy.ranking.objective !== "none"
      ? `Буду искать элементы и ранжировать (${strategy.ranking.objective})`
      : "Буду искать элементы на странице"
    : strategy.kind === "summary"
    ? "Подготовлю краткий обзор страницы"
    : "Буду извлекать конкретные поля";

    onStage?.({ stage: "manifest", status: "start", tool: "Model", toolLabel: "Составляю алгоритм", thinking: `${strategyDesc}. Составляю алгоритм извлечения…` });

    manifest = await ports.model.generateManifest({
      url: input.url,
      goal: input.goal,
      strategy,
      title: capture.title,
      html: capture.html,
      pageContext,
      outline: pageContext.smartOutline,
      structuredData: pageContext.structuredData,
      candidates: pageContext.candidates,
      repeatedGroups: pageContext.repeatedGroups,
      goalRelevantSections
    });

    onStage?.({ stage: "manifest", status: "done", tool: "Model", data: { id: manifest.id, fields: manifest.fields, collections: manifest.collections }, usage: ports.model.getAccumulatedUsage() });

    onStage?.({ stage: "runner", status: "start", tool: "Runner", toolLabel: "Применяю алгоритм", thinking: "Применяю алгоритм к странице…" });

    data = runManifest({ manifest, html: capture.html });
    dataValidation = validateData(manifest, data);

    onStage?.({ stage: "runner", status: "done", tool: "Runner", data: { fieldsExtracted: Object.keys(data).length } });

    onStage?.({ stage: "validation", status: "start", tool: "Validator", toolLabel: "Проверяю результат", thinking: "Проверяю результат…" });

    if (!dataValidation.ok && input.repair !== false && ports.model.repairManifest) {
      onStage?.({ stage: "repair", status: "start", tool: "Model", toolLabel: "Корректирую алгоритм", thinking: "Алгоритм ошибся. Корректирую…" });

      const repairedManifest = await ports.model.repairManifest({
        url: input.url,
        goal: input.goal,
        strategy,
        title: capture.title,
        html: capture.html,
        pageContext,
        outline: pageContext.smartOutline,
        structuredData: pageContext.structuredData,
        candidates: pageContext.candidates,
        repeatedGroups: pageContext.repeatedGroups,
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

      onStage?.({ stage: "repair", status: "done", tool: "Model", data: { repaired }, usage: ports.model.getAccumulatedUsage() });
    }

    onStage?.({ stage: "validation", status: "done", tool: "Validator", data: { ok: dataValidation.ok, issues: dataValidation.issues } });
  }

  let normalizedCandidates: NormalizedCandidate[] = [];
  let classifiedCandidates: ClassifiedCandidate[] = [];
  let ranking: RankingResult | undefined;
  const table: Array<Record<string, unknown>> = [];

  if (strategy!.kind === "collection") {
    onStage?.({ stage: "ranking", status: "start", tool: "Ranker", toolLabel: "Обрабатываю элементы", thinking: "Обрабатываю найденные элементы…" });

    normalizedCandidates = normalizeExtraction({
      data: data!,
      baseUrl: capture.finalUrl,
      maxItems: input.maxItems ?? 2000
    });

    const objective = strategy!.ranking?.objective ?? "none";
    if (objective !== "none") {
      ranking = rankCandidates(normalizedCandidates, input.goal, strategy!);
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

    onStage?.({ stage: "ranking", status: "done", tool: "Ranker", data: { count: table.length }, usage: ports.model.getAccumulatedUsage() });
  }

  onStage?.({ stage: "verify", status: "start", tool: "Model", toolLabel: "Формирую ответ", thinking: "Формирую ответ…" });

  let verification = await ports.model.verifyAndCompose({
    goal: input.goal,
    strategy: strategy!,
    data: data!,
    candidates: strategy!.kind === "collection" ? table : undefined,
    pageTitle: capture.title
  });

  if (!verification.answersGoal && hasNonEmptyData(data!) && (strategy!.kind !== "collection" || table.length > 0)) {
    verification = { ...verification, answersGoal: true };
  }

  onStage?.({ stage: "verify", status: "done", tool: "Model", data: verification, usage: ports.model.getAccumulatedUsage() });

  if (!usedCache && dataValidation!.ok) {
    manifestCache?.set(input.url, input.goal, manifest!);
  }

  const usage = ports.model.getAccumulatedUsage();

  return {
    strategy: strategy!,
    manifest: manifest!,
    data: data!,
    answer: verification.answer,
    table,
    bestItem: classifiedCandidates[0],
    verification,
    artifact: {
      strategy: strategy!,
      normalizationPlan: { maxItems: input.maxItems ?? 2000 },
      rankingPlan: strategy!.ranking,
      paginationPlan: { maxPages: 1, visitedUrls: [capture.finalUrl] }
    },
    validation: {
      page: pageValidation,
      data: dataValidation!
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
    repaired,
    usage
  };
}

function hasNonEmptyData(data: Record<string, unknown>): boolean {
  return Object.values(data).some((v) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0));
}

export async function extractOnce(input: ExtractOnceInput, ports: ExtractPorts): Promise<UniversalExtractResult> {
  return extractUniversal(input, ports);
}
