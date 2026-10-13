import fs from "node:fs";
import { session, open, go, mark, unmark, B, PASSWORD } from "./lib.mjs";
import { api, tidy } from "./video-lib.mjs";
const OUT = process.argv[2];
if (!OUT) { console.error("usage: node screenshots.mjs <out dir> [step,...]"); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
// ids.json: {"goal:<title>": id, "metric:<name>": id, "org:<name>": id, "cycles:<name>": id,
// "teams:<name>": id, "goal-templates:<title>": id} for the seeded demo account.
const ids = new Proxy(JSON.parse(fs.readFileSync(new URL("./ids.json", import.meta.url), "utf8")), {
  // A missing name would open /<resource>/undefined and capture a 404 page.
  get: (o, k) => { if (typeof k === "string" && !(k in o)) throw new Error(`ids.json has no "${k}" - run node ids.mjs`); return o[k]; },
});
const only = process.argv[3] ? process.argv[3].split(",") : null;
const s = await session(); const { page, ctx } = s;
const shot = (name, opts = {}) => page.screenshot({ path: `${OUT}/${name}.png`, ...opts });
const clipTo = async (loc, pad = 12) => { const b = await loc.first().boundingBox(); return { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: Math.min(1440, b.width + 2 * pad), height: b.height + 2 * pad }; };
const dshot = (name) => page.locator(".modal.show .modal-content").last().screenshot({ path: `${OUT}/${name}.png` });
const esc = async () => { await page.keyboard.press("Escape"); await page.waitForTimeout(500); };
const studio = async () => { await go(page, "/dashboard", 2500); await page.locator("select").first().selectOption({ label: "Northwind Studio" }); await page.waitForTimeout(2500); };
const INVITE = "jamie@northwind.example";
async function shareStep() {
  await studio();
  await page.getByRole("button", { name: "Share" }).click(); await page.waitForTimeout(1000);
  await dshot("share-modal");
  const d = page.locator(".modal.show, [role=dialog]").last();
  await d.getByRole("button", { name: "Create link" }).click(); await page.waitForTimeout(1500);
  await dshot("share-created");
  const url = await d.locator("input[readonly], input").evaluateAll(xs => xs.map(x => x.value).find(v => v.includes("/shared/")));
  await esc();
  if (url) { const anon = await open({ anon: true }); await anon.page.goto(url); await anon.page.waitForTimeout(3500); await anon.page.screenshot({ path: `${OUT}/shared-page.png` }); await anon.browser.close(); }
}
async function orgsStep() {
  await go(page, "/platform-org/orgs"); await shot("orgs-list");
  await go(page, `/platform-org/orgs/${ids["org:Northwind Studio"]}`, 3000); await shot("org-page");
  await page.getByRole("button", { name: "Invite member" }).click(); await page.waitForTimeout(800);
  const d = page.locator(".modal.show, [role=dialog]").last(); await d.locator("input[type=email], input").first().fill(INVITE);
  await dshot("invite-modal");
  await d.getByRole("button", { name: "Create invitation" }).click(); await page.waitForTimeout(1500); await shot("invite-created"); await esc();
  await go(page, "/platform-org/teams"); await shot("teams-list");
  await go(page, `/platform-org/teams/${ids["teams:North"]}`, 3000); await shot("team-page");
  await go(page, "/platform-org/invitations"); await shot("invitations");
}
const steps = {
  async auth() {
    const a = await open({ anon: true });
    for (const [n, u] of [["login", "/auth/login"], ["signup", "/auth/signup"], ["forgot", "/auth/forgot"]]) {
      await a.page.goto(B + u); await a.page.waitForTimeout(1500); await a.page.screenshot({ path: `${OUT}/${n}.png`, clip: { x: 420, y: 180, width: 600, height: 540 } });
    }
    await a.browser.close();
  },
  async onboarding() {
    const a = await open({ anon: true }); const p = a.page; const sh = (n) => p.screenshot({ path: `${OUT}/${n}.png` });
    await p.goto(B + "/auth/login"); await p.waitForTimeout(1200);
    await p.fill('input[type=email]', process.env.GOALNEXA_NEW_EMAIL || "sam.lee@northwind.example"); await p.fill('input[type=password]', process.env.GOALNEXA_NEW_PASSWORD || PASSWORD); await p.keyboard.press("Enter");
    await p.waitForURL(/dashboard/); await p.waitForTimeout(3000); await sh("onboarding-start");
    await p.getByText("Use the website").first().click(); await p.waitForTimeout(800);
    const nxt = () => p.getByRole("button", { name: "Next" }).click().then(() => p.waitForTimeout(800));
    await p.getByPlaceholder(/Acme/).fill("Sam's household"); await sh("onboarding-org"); await nxt();
    await p.getByPlaceholder(/Grow monthly revenue/).first().fill("Save for a family trip");
    await p.locator("input[type=date]").first().fill("2027-06-30"); await sh("onboarding-goals"); await nxt();
    await p.getByPlaceholder(/Monthly revenue/).first().fill("Trip fund");
    await p.getByPlaceholder(/unit/i).first().fill("$").catch(() => {});
    const nums = p.locator("input[type=number], input[inputmode=decimal]"); await nums.nth(1).fill("3000").catch(() => {});
    await sh("onboarding-metrics"); await nxt(); await sh("onboarding-review");
    await p.getByRole("button", { name: "Back" }).click(); await p.getByRole("button", { name: "Back" }).click(); await p.getByRole("button", { name: "Back" }).click(); await p.waitForTimeout(500);
    await p.getByRole("button", { name: "Back" }).click().catch(() => {}); await p.waitForTimeout(500);
    await p.getByText("Use an AI agent").first().click(); await p.waitForTimeout(1500); await sh("onboarding-agent");
    await a.browser.close();
  },
  async dashboard() {
    await studio(); await shot("dashboard");
    // annotated overview
    await mark(page.locator(".card").filter({ hasText: "Filters" }).locator("select").first(), 1);
    await mark(page.locator(".card").filter({ hasText: "Filters" }).locator("select").nth(1), 2);
    await mark(page.getByRole("button", { name: "Launch v2 of the mobile app" }).first(), 3);
    await mark(page.getByLabel("Hide Launch v2 of the mobile app"), 4);
    await mark(page.getByText("→ 128% by Dec 15").first().or(page.getByText(/by Dec 15/).first()), 5);
    await mark(page.getByText("On track").first(), 6);
    await mark(page.getByRole("button", { name: "Share" }), 7);
    await shot("dashboard-annotated"); await unmark(page);
    // tooltip on a chart point
    const svg = page.locator(".gn-viz svg, svg").filter({ has: page.locator("circle") }).first();
    const bb = await svg.boundingBox(); await page.mouse.move(bb.x + bb.width * 0.42, bb.y + bb.height * 0.5); await page.waitForTimeout(700);
    await shot("dashboard-tooltip", { clip: { x: 620, y: 70, width: 820, height: 360 } });
    await page.mouse.move(10, 10);
    await shot("goal-tree", { clip: await clipTo(page.locator(".card").filter({ hasText: "Filters" }), 0) });
  },
  async newgoal() {
    await studio();
    await mark(page.getByRole("button", { name: "New goal" }), 1); await shot("newgoal-button", { clip: { x: 224, y: 80, width: 390, height: 300 } }); await unmark(page);
    await page.getByRole("button", { name: "New goal" }).click(); await page.waitForTimeout(1500);
    const d = page.locator(".modal.show, [role=dialog]").last();
    await d.getByLabel("Title").fill("Run a 10 km race under 50 minutes");
    await d.getByLabel("Description").fill("Spring city 10K.").catch(() => {});
    await d.locator("input[type=date]").first().fill("2027-04-18").catch(() => {});
    await page.waitForTimeout(400); await dshot("newgoal-modal");
    await esc();
  },
  async addmetric() {
    await studio();
    await page.getByLabel("Add to Launch v2 of the mobile app").click(); await page.waitForTimeout(500);
    await mark(page.getByRole("button", { name: "Add metric" }), 1);
    await shot("goal-plus-menu", { clip: { x: 224, y: 300, width: 400, height: 260 } }); await unmark(page);
    await page.getByRole("button", { name: "Add metric" }).click(); await page.waitForTimeout(1500);
    const d = page.locator(".modal.show, [role=dialog]").last();
    await d.getByLabel("Name").fill("Downloads"); await d.getByLabel("Unit").fill("installs");
    await d.getByLabel(/Base value|Start/i).first().fill("0").catch(() => {}); await d.getByLabel(/Target value|Target/i).first().fill("20000").catch(() => {});
    await page.waitForTimeout(400); await dshot("newmetric-modal");
    await d.getByText("Check in every").first().evaluate(el => el.scrollIntoView({ block: "start" })); await page.waitForTimeout(500); await dshot("newmetric-modal-2");
    await esc();
  },
  async checkin() {
    await studio();
    await page.getByLabel("Check in or add to Beta testers").click(); await page.waitForTimeout(500);
    await mark(page.getByRole("button", { name: "Check in", exact: true }), 1);
    await shot("metric-plus-menu", { clip: { x: 224, y: 330, width: 400, height: 200 } }); await unmark(page);
    await page.getByRole("button", { name: "Check in", exact: true }).click(); await page.waitForTimeout(1200);
    const d = page.locator(".modal.show, [role=dialog]").last();
    await d.locator("input").first().fill("380"); await d.getByLabel("Note").fill("Waitlist email sent");
    await dshot("checkin-modal"); await esc();
    // due clock on personal goals
    const clock = page.locator("[title*='Check-in due'], [aria-label*='due']").first();
    if (await clock.count()) { await mark(clock, 1); await shot("due-clock", { clip: { x: 224, y: 80, width: 400, height: 420 } }); await unmark(page); }
  },
  async drawer() {
    await studio();
    await page.getByRole("button", { name: "Launch v2 of the mobile app" }).first().click(); await page.waitForTimeout(2500);
    await shot("drawer-goal");
    const dr = page.locator(".offcanvas.show, [role=dialog]").last();
    for (const [txt, name] of [["Sharing", "drawer-sharing"], ["Activity", "drawer-activity"]]) {
      const h = dr.getByText(txt, { exact: true }).first(); await h.scrollIntoViewIfNeeded().catch(() => {}); await h.evaluate(el => el.scrollIntoView({ block: "start" })).catch(() => {}); await page.waitForTimeout(500); await shot(name);
    }
    await esc();
    await page.getByRole("button", { name: "Beta testers" }).first().click(); await page.waitForTimeout(2500);
    await shot("drawer-metric");
    await esc();
  },
  async share() {
    // Revoke the link this step makes, however far it gets.
    const before = new Set((await api("dashboard-shares")).items.map((x) => x.id));
    try { await shareStep(); } finally {
      await tidy({ shares: (await api("dashboard-shares")).items.map((x) => x.id).filter((id) => !before.has(id)) });
    }
  },
  async orgs() {
    await tidy({ invites: [INVITE] });
    try { await orgsStep(); } finally { await tidy({ invites: [INVITE] }); }
  },
  async table() {
    await go(page, "/table", 1500); await page.locator("select").first().selectOption({ label: "Northwind Studio" }); await page.waitForTimeout(2500);
    await page.locator("select").last().selectOption({ label: "Week" }).catch(() => {}); await page.waitForTimeout(2000);
    await shot("table");
    const inputs = page.locator("input[type=number], input[inputmode=decimal]");
    if (await inputs.count() > 1) { await inputs.nth(0).fill("372"); await inputs.nth(1).fill("4.3"); }
    await mark(page.getByRole("button", { name: /^Save/ }).first(), 2);
    await shot("table-entry"); await unmark(page);
  },
  async reminders() { await go(page, "/reminders"); await shot("reminders"); },
  async board() {
    await go(page, "/board", 2500); await page.locator("select").first().selectOption({ label: "Northwind" }); await page.waitForTimeout(3000); await shot("board");
    await page.getByRole("button", { name: "Targets" }).click(); await page.waitForTimeout(1500); await shot("board-targets");
    await page.getByRole("button", { name: "Check in" }).first().click(); await page.waitForTimeout(1000);
    const showBy = page.locator("select").filter({ has: page.locator("option", { hasText: "Running totals" }) });
    await showBy.selectOption({ label: "Week" }).catch(() => {}); await page.waitForTimeout(2000); await shot("board-showby");
    await showBy.selectOption({ label: "Running totals" }).catch(() => {});
    await page.getByRole("button", { name: /Full screen/ }).click(); await page.waitForTimeout(1200); await shot("board-fullscreen"); await page.getByRole("button", { name: /Exit full screen/ }).click(); await page.waitForTimeout(800);
    await page.getByText("+ New").first().click(); await page.waitForTimeout(1200); await dshot("template-wizard-1");
    const d = page.locator(".modal.show, [role=dialog]").last();
    await d.locator("input").first().fill("Support quality"); await d.getByRole("button", { name: "Next" }).click(); await page.waitForTimeout(600);
    await d.locator("input").first().fill("Happy customers"); await d.getByRole("button", { name: "Next" }).click(); await page.waitForTimeout(600);
    await dshot("template-wizard-3"); await esc();
  },
  async lists() {
    await go(page, "/goals"); await shot("goals-list");
    await page.getByRole("button", { name: /Filter/ }).first().click(); await page.waitForTimeout(800);
    await page.locator(".modal.show select, [role=dialog] select").first().selectOption({ index: 1 }).catch(() => {}); await page.waitForTimeout(600);
    await dshot("filter-modal"); await esc();
    await go(page, `/goals/${ids["goal:Launch v2 of the mobile app"]}`, 3000); await shot("goal-page");
    await go(page, `/metrics/${ids["metric:Beta testers"]}`, 3000); await shot("metric-page");
    const ing = page.getByText("Automatic check-ins").first(); await ing.evaluate(el => el.scrollIntoView({ block: "start" })).catch(() => {}); await page.waitForTimeout(500); await shot("metric-ingest");
    await go(page, "/cycles", 2500); await shot("cycles-list");
    await go(page, `/cycles/${ids["cycles:Q4 2026"]}`, 3000); await shot("cycle-page");
    const c = page.getByText("Close this cycle").first(); await c.evaluate(el => el.scrollIntoView({ block: "start" })).catch(() => {}); await page.waitForTimeout(500); await shot("cycle-close");
    await go(page, `/goal-templates/${ids["goal-templates:Quarterly sales targets"]}`, 3000); await shot("template-page");
  },
  async mcp() {
    await go(page, "/mcp", 3000); await shot("mcp");
    await page.getByRole("button", { name: /^Claude\b/ }).first().click().catch(() => page.getByText("Claude", { exact: true }).first().click());
    await page.waitForTimeout(1200); await shot("mcp-claude");
    await go(page, "/mcp", 2500); await page.getByRole("button", { name: "New token" }).click(); await page.waitForTimeout(800);
    await page.locator(".modal.show input, [role=dialog] input").first().fill("Claude Code on my laptop"); await dshot("mcp-token-modal"); await esc();
  },
  async account() {
    await go(page, "/account"); await shot("account"); await go(page, "/email/preferences"); await shot("email-preferences");
  },
  async usermenu() {
    await go(page, "/dashboard"); await page.getByLabel("Account menu for Alex Rivera").last().click(); await page.waitForTimeout(600);
    await shot("user-menu", { clip: { x: 1040, y: 0, width: 400, height: 560 } });
  },
  async system() {
    for (const p of ["status", "settings", "users", "insights", "audit-events", "all-orgs"]) { await go(page, `/system/${p}`, 3500);
      if (["users", "all-orgs"].includes(p)) { await page.getByPlaceholder(/Search/).first().fill("northwind"); await page.waitForTimeout(2000); }
      await shot(`system-${p}`); }
    await go(page, "/system/users", 2500); await page.locator("tbody tr").filter({ hasText: "alex@northwind" }).first().click(); await page.waitForTimeout(3000); await shot("system-user");
  },
};
for (const [k, fn] of Object.entries(steps)) {
  if (only && !only.includes(k)) continue;
  try { await fn(); console.log("ok", k); } catch (e) { console.log("FAIL", k, e.message.split("\n")[0]); await shot(`_fail-${k}`).catch(() => {}); await esc().catch(() => {}); }
}
await s.done();
