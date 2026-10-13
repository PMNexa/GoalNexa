import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// The signed-in session (a refresh cookie) - kept outside the repo.
const STATE = path.join(os.tmpdir(), "goalnexa-manual-state.json");
import { chromium } from "playwright";
import { B, EMAIL, PASSWORD } from "./video-lib.mjs";
export { B, EMAIL, PASSWORD };
export async function open(opts = {}) {
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: opts.anon || !fs.existsSync(STATE) ? undefined : STATE, ...opts.ctx });
  const page = await ctx.newPage();
  return { browser, ctx, page };
}
export async function session(opts = {}) {
  const s = await open(opts);
  const { page, ctx } = s;
  await page.goto(B + "/dashboard"); await page.waitForTimeout(2500);
  if (page.url().includes("/auth/login")) {
    await page.fill('input[type=email]', EMAIL);
    await page.fill('input[type=password]', PASSWORD);
    await page.keyboard.press("Enter");
    await page.waitForURL(/dashboard/, { timeout: 15000 });
    await page.waitForTimeout(2000);
  }
  s.done = async () => { await ctx.storageState({ path: STATE }); await s.browser.close(); };
  return s;
}
export async function go(page, path, wait = 2500) { await page.goto(B + path); await page.waitForTimeout(wait); }
// Draw a red outline + numbered badge on elements (for step-by-step shots).
export async function mark(locator, n) {
  await locator.first().evaluate((el, n) => {
    el.dataset.gnMark = "1";
    el.style.outline = "3px solid #e03131"; el.style.outlineOffset = "2px"; el.style.borderRadius ||= "4px";
    if (n != null) {
      const r = el.getBoundingClientRect(), b = document.createElement("div");
      b.className = "gn-mark-badge"; b.textContent = n;
      Object.assign(b.style, { position: "fixed", left: Math.max(2, r.left - 14) + "px", top: Math.max(2, r.top - 14) + "px", width: "24px", height: "24px",
        borderRadius: "50%", background: "#e03131", color: "#fff", font: "bold 13px/24px sans-serif", textAlign: "center", zIndex: 99999, boxShadow: "0 1px 3px rgba(0,0,0,.4)" });
      document.body.appendChild(b);
    }
  }, n);
}
export async function unmark(page) {
  await page.evaluate(() => { document.querySelectorAll(".gn-mark-badge").forEach(b => b.remove());
    document.querySelectorAll("[data-gn-mark]").forEach(el => { el.style.outline = ""; el.style.outlineOffset = ""; delete el.dataset.gnMark; }); });
}
export const dialogText = async (page) => (await page.locator(".modal.show, .offcanvas.show, [role=dialog]").allInnerTexts()).join("\n---\n").slice(0, 2500);
