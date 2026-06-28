import { chromium } from "playwright";
import type { WaitStrategy } from "@parsewright/manifest";

export interface PageCapture {
  url: string;
  finalUrl: string;
  status?: number;
  title: string;
  html: string;
  baseUrl: string;
  favicon?: string;
  jsonResponses: CapturedJsonResponse[];
  timingMs: number;
  capturedAt: string;
}

export interface CapturedJsonResponse {
  url: string;
  status: number;
  contentType: string;
  body: unknown;
}

export interface CapturePageInput {
  url: string;
  wait?: Partial<WaitStrategy>;
}

export async function capturePage(input: CapturePageInput): Promise<PageCapture> {
  const wait: WaitStrategy = {
    kind: "selector_or_timeout",
    timeoutMs: 10000,
    settleMs: 500,
    ...input.wait
  };

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const startedAt = Date.now();
    const jsonResponses: CapturedJsonResponse[] = [];
    page.on("response", async (response) => {
      if (jsonResponses.length >= 20) return;
      const contentType = response.headers()["content-type"] ?? "";
      if (!contentType.includes("json")) return;
      try {
        const responseUrl = new URL(response.url());
        const inputUrl = new URL(input.url);
        if (responseUrl.origin !== inputUrl.origin) return;
        const body = await response.json();
        jsonResponses.push({ url: response.url(), status: response.status(), contentType, body: boundJson(body) });
      } catch {
        // Ignore non-readable or streaming responses.
      }
    });
    const response = await page.goto(input.url, {
      waitUntil: wait.kind === "domcontentloaded" ? "domcontentloaded" : "load",
      timeout: wait.timeoutMs
    });

    if (wait.selector) {
      await page.locator(wait.selector).first().waitFor({ timeout: wait.timeoutMs }).catch(() => undefined);
    }

    if (wait.kind === "networkidle") {
      await page.waitForLoadState("networkidle", { timeout: wait.timeoutMs }).catch(() => undefined);
    }

    if (wait.settleMs > 0) await page.waitForTimeout(wait.settleMs);

    const finalUrl = page.url();
    const favicon = await page
      .locator('link[rel~="icon"], link[rel="shortcut icon"]')
      .first()
      .getAttribute("href")
      .catch(() => undefined);

    return {
      url: input.url,
      finalUrl,
      status: response?.status(),
      title: await page.title(),
      html: await page.content(),
      baseUrl: new URL(finalUrl).origin,
      favicon: favicon ? new URL(favicon, finalUrl).toString() : undefined,
      jsonResponses,
      timingMs: Date.now() - startedAt,
      capturedAt: new Date().toISOString()
    };
  } finally {
    await browser.close();
  }
}

function boundJson(value: unknown): unknown {
  const text = JSON.stringify(value);
  if (text.length <= 50000) return value;
  return { truncated: true, preview: text.slice(0, 50000) };
}
