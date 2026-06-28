import { chromium } from "playwright";
import type { WaitStrategy } from "@parsewright/manifest";

export interface PageCapture {
  url: string;
  finalUrl: string;
  status?: number;
  title: string;
  html: string;
  capturedAt: string;
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

    return {
      url: input.url,
      finalUrl: page.url(),
      status: response?.status(),
      title: await page.title(),
      html: await page.content(),
      capturedAt: new Date().toISOString()
    };
  } finally {
    await browser.close();
  }
}
