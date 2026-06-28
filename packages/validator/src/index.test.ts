import { describe, expect, it } from "vitest";
import { validatePage } from "./index.js";

describe("validatePage", () => {
  it("does not mark a page blocked only because cookie text mentions CAPTCHA", () => {
    const result = validatePage({
      status: 200,
      html: `
        <main>
          <a class="tc-item" href="/offer?id=1">ChatGPT Plus <span>611 ₽</span></a>
          <p>Cookie files keep preferences. Some site features can use a CAPTCHA test during registration.</p>
        </main>
      `
    });

    expect(result.ok).toBe(true);
  });

  it("marks explicit challenge pages as blocked", () => {
    const result = validatePage({
      status: 200,
      html: "<main>Please verify captcha to continue.</main>"
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({ code: "page_blocked", message: "Page looks blocked or challenged." });
  });
});
