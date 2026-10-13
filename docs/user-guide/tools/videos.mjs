// The video manual: one narrated screen recording per topic.
// node videos.mjs <out dir> [episode,...]   (see README for setup)
import fs from "node:fs";
import { film, speech, TTS } from "./video-lib.mjs";

const OUT = process.argv[2];
const only = process.argv[3] ? process.argv[3].split(",") : null;
const ids = new Proxy(JSON.parse(fs.readFileSync(new URL("./ids.json", import.meta.url), "utf8")), {
  // A missing name would open /<resource>/undefined and capture a 404 page.
  get: (o, k) => { if (typeof k === "string" && !(k in o)) throw new Error(`ids.json has no "${k}" - run node ids.mjs`); return o[k]; },
});
const NEW_EMAIL = process.env.GOALNEXA_NEW_EMAIL || "sam.lee@northwind.example";

// The demo organization (scripts/seed_demo.py plus the team template data) and one of its goals.
const ORG = process.env.GOALNEXA_ORG || "Northwind";
const GOAL = process.env.GOALNEXA_GOAL || "Grow revenue";
const METRIC = process.env.GOALNEXA_METRIC || "Revenue";
const personal = async (k) => { await k.page.locator("select").first().selectOption({ label: "Personal (no organization)" }); await k.wait(2500); };
const studio = async (k) => { if (!k.page.url().includes("/dashboard")) await k.go("/dashboard", 2000); await k.page.locator("select").first().selectOption({ label: ORG }); await k.wait(2500); };
const filters = (k) => k.page.locator(".card").filter({ hasText: "Filters" });
// Click a destructive button, then accept its confirmation: a browser
// confirm, or a modal that opened because of the click (never one that
// was already open - e.g. the Share dialog itself).
const clickConfirm = async (k, loc, name) => {
  const modals = k.page.locator(".modal.show"); const before = await modals.count();
  const accept = (x) => x.accept();
  k.page.once("dialog", accept);
  // A modal instead: don't leave the listener to accept a later, unrelated confirm.
  try { await k.click(loc, 800); } finally { k.page.off("dialog", accept); }
  if (await modals.count() > before) await k.click(modals.last().getByRole("button", { name }).last(), 800);
};

const episodes = [
  { name: "01-getting-started", kicker: "Chapter 1", title: "Getting started", sub: "Sign up, sign in and the onboarding wizard", signIn: false,
    async run(k) {
      const p = k.page;
      await k.say("To sign in, enter your email and password, then click Sign In.");
      await k.point(p.locator("input[type=email]")); await k.point(p.locator("input[type=password]"));
      await k.hl(p.getByRole("button", { name: /sign in/i }));
      await k.say("New to GoalNexa? Click Sign up.");
      await k.click(p.getByRole("link", { name: /sign up/i }), 1500);
      await k.say("Enter your name, your email and a password of at least eight characters. Then click Sign Up.");
      await k.type(p.getByLabel(/name/i).first(), "Sam Lee");
      await k.type(p.locator("input[type=email]"), "sam@example.com");
      await k.type(p.locator("input[type=password]").first(), "a-long-password");
      await k.hl(p.getByRole("button", { name: /sign up/i }));
      await k.say("If your administrator asks for confirmed addresses, open the link we email you.");
      await k.go("/auth/login", 1200);
      await k.say("Forgot your password? Click Forgot password, and we'll email you a link that works for two hours.");
      await k.click(p.getByText(/forgot password/i), 1500);
      await k.idle();
      await k.go("/auth/login", 1200);
      await k.say("The first time you sign in, with no goals yet, a short wizard helps you set up.");
      await k.type(p.locator("input[type=email]"), NEW_EMAIL);
      await k.type(p.locator("input[type=password]"), "CorrectHorse!Battery9");
      await k.click(p.getByRole("button", { name: /sign in/i }), 3500);
      await k.say("First, choose how you'll use GoalNexa. Let's pick Use the website.");
      await k.hl(p.getByText("Use an AI agent").first(), 900);
      await k.click(p.getByText("Use the website").first());
      const next = () => k.click(p.getByRole("button", { name: "Next" }));
      await k.say("Name your organization: your team, company or household. Then click Next.");
      await k.type(p.getByPlaceholder(/Acme/), "Sam's household"); await next();
      await k.say("Type a goal, and optionally a target date, so GoalNexa can predict whether you'll make it.");
      await k.type(p.getByPlaceholder(/Grow monthly revenue/).first(), "Save for a family trip");
      await k.point(p.locator("input[type=date]").first()); await p.locator("input[type=date]").first().fill("2027-06-30"); await k.wait(500);
      await next();
      await k.say("Add a metric for each goal: one number with a start and a target.");
      await k.type(p.getByPlaceholder(/Monthly revenue/).first(), "Trip fund");
      await k.type(p.getByPlaceholder(/unit/i).first(), "$").catch(() => {});
      await k.type(p.locator("input[type=number], input[inputmode=decimal]").nth(1), "3000").catch(() => {});
      await next();
      await k.say("Check the summary, and click Create and open dashboard. Nothing is saved before this step.");
      await k.hl(p.getByRole("button", { name: /Create and open dashboard/ }), 2500);
      await k.idle();
      for (let i = 0; i < 4; i++) await p.getByRole("button", { name: "Back" }).click().then(() => k.wait(400)).catch(() => {});
      await k.say("Prefer chatting? Use an AI agent connects Claude, ChatGPT and others, and your assistant sets everything up.");
      await k.click(p.getByText("Use an AI agent").first(), 2500);
      await k.say("Skip for now opens an empty dashboard instead.");
    } },

  { name: "02-dashboard", kicker: "Chapter 3", title: "The dashboard", sub: "Read progress, predictions and health",
    setup: studio,
    async run(k) {
      const p = k.page;
      await k.say("The dashboard is the main screen. Pick goals on the left, read their charts on the right.");
      await k.say("Choose whose goals to show: an organization, or your personal goals.");
      await k.hl(filters(k).locator("select").first());
      await k.say("Show check-ins by gives one value per day, week or month.");
      await k.hl(filters(k).locator("select").nth(1));
      await k.say("Each goal shows its color, its progress, and its metrics below it.");
      await k.point(p.getByRole("button", { name: GOAL, exact: true }).first(), 1200);
      await k.say("The eye shows or hides a goal in the charts. Up to eight goals at a time.");
      await k.click(p.getByLabel(`Hide ${GOAL}`, { exact: true }), 1500);
      await k.click(p.getByLabel(`Show ${GOAL}`, { exact: true }), 1200).catch(() => {});
      await k.say("Show first 8 brings the first eight goals back.");
      await k.click(p.getByRole("button", { name: "Show first 8" }), 1500);
      await k.say("Each line is one metric's progress, from its start to its target. Hover a point to see the actual reading.");
      const svg = p.locator(".gn-viz svg").filter({ has: p.locator("circle") }).first();
      const bb = await svg.boundingBox();
      if (bb) { await p.mouse.move(bb.x + bb.width * 0.3, bb.y + bb.height * 0.5, { steps: 20 }); await p.mouse.move(bb.x + bb.width * 0.45, bb.y + bb.height * 0.5, { steps: 30 }); await k.wait(1500); }
      await k.say("The dashed line is the prediction: where each metric is heading by the target date.");
      await k.hl(p.getByText(/→ \d+% by/).first(), 2000);
      await k.say("The badge tells you the health: on track, at risk, off track, or achieved.");
      await k.hl(p.getByText(/^(On track|At risk|Off track|Achieved)$/).first(), 2000);
      await k.say("Click a goal's title to open its details in a side panel.");
      await k.click(p.getByRole("button", { name: GOAL, exact: true }).first(), 3000);
      await k.idle(); await p.keyboard.press("Escape"); await k.wait(800);
    } },

  { name: "03-goals-metrics-checkins", kicker: "Chapters 4 and 5", title: "Goals, metrics and check-ins", sub: "Create a goal, measure it, record progress",
    setup: personal, cleanup: { goals: ["Run a 10 km race under 50 minutes"] },
    async run(k) {
      const p = k.page;
      const goal = "Run a 10 km race under 50 minutes";
      await k.say("To create a goal, click New goal in the Goals header.");
      await k.click(p.getByRole("button", { name: "New goal" }), 1500);
      let d = k.dialog();
      await k.say("Write the title as an outcome. It's the only required field.");
      await k.type(d.getByLabel("Title"), goal);
      await k.say("A target date lets GoalNexa predict whether you'll make it.");
      const date = d.locator("input[type=date]").first(); await k.point(date); await date.fill("2027-04-18"); await k.wait(600);
      await k.say("Click Create.");
      await k.click(d.getByRole("button", { name: "Create", exact: true }), 2500);
      await k.say("Now measure it. Click the plus on the goal's row, and choose Add metric.");
      await k.click(p.getByLabel(`Add to ${goal}`), 600);
      await k.click(p.getByRole("button", { name: "Add metric" }), 1500);
      d = k.dialog();
      await k.say("A metric is one number. Give it a name and a unit.");
      await k.type(d.getByLabel("Name"), "10 km time"); await k.type(d.getByLabel("Unit"), "min");
      await k.say("The base value is where you start. The target is where you want to be. Here it's lower, because faster is better.");
      await k.type(d.getByLabel(/Base value/).first(), "58"); await k.type(d.getByLabel(/Target value/).first(), "50");
      await k.say("Each check-in is a new reading here. For things like kilometres run, choose an amount to add instead.");
      await k.idle();
      await k.click(d.getByRole("button", { name: "Create", exact: true }), 2500);
      await k.say("Now record progress. On the metric's plus, choose Check in.");
      await k.click(p.getByLabel("Check in or add to 10 km time"), 600);
      await k.click(p.getByRole("button", { name: "Check in", exact: true }), 1500);
      d = k.dialog();
      await k.say("Enter the value. Leave When blank for now, or set it to backdate. Add a note if you like.");
      await k.type(d.locator("input").first(), "56"); await k.type(d.getByLabel("Note"), "Park run");
      await k.say("Click Save check-in. The chart, progress and health update right away.");
      await k.click(d.getByRole("button", { name: /Save check-in/ }), 2000);
      await k.scrollTo(p.locator(".card").filter({ has: p.getByText(goal, { exact: true }) }).last(), 2500);
      await k.say("To edit or delete, click the goal's name. The side panel has Edit and Delete.");
      await k.click(p.getByRole("button", { name: goal }).first(), 2500);
      const dr = p.locator(".offcanvas.show, [role=dialog]").last();
      await k.hl(dr.getByRole("button", { name: "Edit" }).first(), 1000);
      await k.say("This was just a demo, so let's delete it.");
      await clickConfirm(k, dr.getByRole("button", { name: "Delete" }).first(), /Delete/);
      await k.wait(1500); await p.keyboard.press("Escape").catch(() => {});
    } },

  { name: "04-check-in-table", kicker: "Chapter 5", title: "The check-in table", sub: "Many check-ins at once",
    start: "/table",
    async run(k) {
      const p = k.page;
      await k.say("The check-in table shows every goal and metric as rows, and their history as columns.");
      await k.select(p.locator("select").first(), ORG, 2500);
      await k.say("Snap to sets one column per hour, day, week or month.");
      await k.select(p.locator("select").last(), "Week", 2000);
      await k.say("Type a value for each metric in the right-hand column. Enter moves to the next one.");
      const inputs = p.locator("input[type=number], input[inputmode=decimal]");
      await k.type(inputs.nth(0), "372"); await k.type(inputs.nth(1), "4.3");
      await k.say("Then click Save, once, for all of them.");
      await k.hl(p.getByRole("button", { name: /^Save/ }).first(), 2000);
      await k.say("Hover a value to read its note. Drag a row's name to reorder.");
    } },

  { name: "05-reminders", kicker: "Chapter 6", title: "Reminders and the goals digest", sub: "Get nudged when a check-in is due",
    start: "/reminders",
    async run(k) {
      const p = k.page;
      await k.say("Reminders work for metrics with a schedule. Set Check in every on a metric to daily, weekly or monthly.");
      await k.say("On the Reminders page, turn on Send me reminders.");
      await k.hl(p.getByText("Send me reminders").first());
      await k.say("Choose where they go: your email, or services like Telegram, Slack or ntfy. One address per line.");
      await k.hl(p.locator("textarea").first(), 1500);
      await k.say("The examples on the right show the address format for each service.");
      await k.hl(p.getByText(/URL examples/).first(), 1500);
      await k.say("The goals digest is a summary of what moved, what's at risk and what's due. Daily, or weekly on the day you pick.");
      await k.hl(p.getByText("Goals digest").first(), 1500);
      await k.say("Click Save, then Send a test to check it arrives.");
      await k.hl(p.getByRole("button", { name: "Save" }).first(), 900);
      await k.hl(p.getByRole("button", { name: /Send a test/ }).first(), 900);
      await k.say("You get one message per due date, listing everything overdue. No repeated nagging.");
    } },

  { name: "06-working-with-a-team", kicker: "Chapter 7", title: "Working with a team", sub: "Organizations, invitations, private goals and comments",
    start: "/platform-org/orgs", cleanup: { invites: ["taylor@northwind.example"] },
    async run(k) {
      const p = k.page;
      await k.say("An organization's goals are shared with its members. Create one with New organization.");
      await k.hl(p.getByRole("link", { name: /New/ }).or(p.getByRole("button", { name: /New/ })).first());
      await k.say("Open an organization to see its members and invite people.");
      await k.go(`/platform-org/orgs/${ids[`org:${ORG}`]}`, 3000);
      await k.say("Click Invite member, enter their email, and pick a role. Members work on the goals. Admins also manage members.");
      await k.click(p.getByRole("button", { name: "Invite member" }), 1000);
      const d = k.dialog();
      await k.type(d.locator("input[type=email], input").first(), "taylor@northwind.example");
      await k.click(d.getByRole("button", { name: "Create invitation" }), 2000);
      await k.say("GoalNexa doesn't send the email. Click Copy link, and send it yourself. The link works for two weeks.");
      await k.hl(p.getByRole("button", { name: /Copy link/ }).first(), 2000);
      await k.idle(); await p.keyboard.press("Escape"); await k.wait(800);
      await k.say("Pending invitations can be copied again or revoked. Let's revoke this demo one.");
      const row = p.locator("tr, li, .list-group-item").filter({ hasText: "taylor@northwind.example" }).last();
      await clickConfirm(k, row.getByRole("button", { name: /Revoke/ }), /Revoke/); await k.wait(1200);
      await k.say("To make a goal private, open it, and go to Sharing.");
      await studio(k);
      await k.click(p.getByRole("button", { name: GOAL, exact: true }).first(), 2500);
      const dr = p.locator(".offcanvas.show, [role=dialog]").last();
      await k.scrollTo(dr.getByText("Sharing", { exact: true }).first(), 1200);
      await k.say("Public means the whole organization. Private means only you and the members you add.");
      await k.hl(dr.getByText("Visibility", { exact: true }).first(), 1800);
      await k.say("Under Activity, the team sees who checked in what, and can comment next to the numbers.");
      await k.scrollTo(dr.getByText("Activity", { exact: true }).first(), 1200);
      await k.point(dr.getByPlaceholder(/Write a comment/).first(), 1500);
      await k.idle(); await p.keyboard.press("Escape"); await k.wait(600);
    } },

  { name: "07-cycles", kicker: "Chapter 8", title: "Cycles", sub: "Plan by quarter, then close and score",
    start: "/cycles",
    async run(k) {
      const p = k.page;
      await k.say("A cycle is a period, usually a quarter, that goals belong to. Create one with New cycle: a name and its dates.");
      await k.hl(p.getByRole("link", { name: /New/ }).or(p.getByRole("button", { name: /New/ })).first());
      await k.say("Goals join a cycle through their Cycle field. On the dashboard, pick the cycle first, and New goal presets it.");
      await k.say("At the end of the quarter, open the cycle.");
      await k.go(`/cycles/${ids["cycles:Q4 2026"]}`, 3000);
      await k.scrollTo(p.getByText("Close this cycle").first(), 1200);
      await k.say("Give each goal a score from zero to one. It starts from the goal's progress. Point seven counts as achieved.");
      await k.hl(p.locator("input[type=number]").first(), 1500);
      await k.say("Then choose what happens: done, roll over into the next cycle, or drop.");
      await k.hl(p.locator("select").first(), 1500);
      await k.say("Finally, click Close cycle. This can't be undone. The cycle then shows a scorecard.");
      await k.hl(p.getByRole("button", { name: /Close cycle/ }).first(), 2000);
    } },

  { name: "08-teams-and-team-board", kicker: "Chapter 9", title: "Teams and the team board", sub: "One goal system across many teams",
    start: "/platform-org/teams",
    async run(k) {
      const p = k.page;
      await k.say("When several teams run the same goals, start by creating the teams, with sub-teams if you need them.");
      await k.say("Open a team to add leads, who set targets, and members, who check in.");
      await k.go(`/platform-org/teams/${ids["teams:North"]}`, 3000);
      await k.say("Then open the Team board, and pick the organization, the goal template and the cycle.");
      await k.go("/board", 3000);
      const orgPick = p.locator("select").filter({ has: p.locator("option", { hasText: ORG }) }); // shown with 2+ organizations
      if (await orgPick.count()) await k.select(orgPick, ORG, 3000);
      await k.say("Rows are teams, columns are metrics. Each cell shows current against target, and the pace needed.");
      await k.point(p.locator("td").nth(8), 1500);
      await k.say("Totals for each department and the whole organization are calculated from the teams.");
      await k.say("In Targets mode, set each team's start and target, then Save targets.");
      await k.click(p.getByRole("button", { name: "Targets" }), 2000);
      await k.say("In Check in mode, type every team's number, then Save check-ins.");
      await k.click(p.getByRole("button", { name: "Check in" }).first(), 1500);
      await k.say("Show by week compares each period instead of running totals.");
      const showBy = p.locator("select").filter({ has: p.locator("option", { hasText: "Running totals" }) });
      await k.select(showBy, "Week", 2500); await showBy.selectOption({ label: "Running totals" }); await k.wait(1200);
      await k.say("Full screen shows just the board, for the team meeting.");
      await k.click(p.getByRole("button", { name: /Full screen/ }), 2500);
      await k.click(p.getByRole("button", { name: /Exit full screen/ }), 1200);
      await k.say("To define the goals once for every team, create a goal template with New.");
      await k.click(p.getByText("+ New").first(), 1500);
      const d = k.dialog();
      await k.type(d.locator("input").first(), "Support quality"); await k.click(d.getByRole("button", { name: "Next" }), 700);
      await k.type(d.locator("input").first(), "Happy customers"); await k.click(d.getByRole("button", { name: "Next" }), 1200);
      await k.say("For each metric, choose how teams add up: add up, average, or lowest team. Then pick the teams, and create.");
      await k.idle(); await p.keyboard.press("Escape"); await k.wait(800);
    } },

  { name: "09-sharing-a-dashboard", kicker: "Chapter 10", title: "Sharing a dashboard", sub: "A live, read-only link for anyone",
    setup: studio, cleanup: { shares: ["Leadership update"] },
    async run(k) {
      const p = k.page;
      await k.say("Show the goals you want to share, and untick metrics to leave out. Then click Share.");
      await k.click(p.getByRole("button", { name: "Share" }), 1200);
      let d = k.dialog();
      await k.say("Give the link a name, and click Create link.");
      await k.type(d.locator("input").first(), "Leadership update");
      await k.click(d.getByRole("button", { name: "Create link" }), 1500);
      await k.say("Click Copy, and send it.");
      await k.hl(d.getByRole("button", { name: /^Copy/ }).first(), 1200);
      const url = await d.locator("input").evaluateAll((xs) => xs.map((x) => x.value).find((v) => v.includes("/shared/")));
      await k.idle(); await p.keyboard.press("Escape"); await k.wait(500);
      await k.say("Anyone with the link sees the charts, live, without signing in. No notes or names are shown.");
      if (url) { await p.goto(url); await k.wait(4000); }
      await k.say("To end a link, open Share again, and click Revoke under Your links.");
      await studio(k);
      await k.click(p.getByRole("button", { name: "Share" }), 1200);
      d = k.dialog();
      const row = d.locator("tr, li, .list-group-item").filter({ hasText: "Leadership update" }).last();
      await clickConfirm(k, row.getByRole("button", { name: /Revoke/ }), /Revoke/); await k.wait(1200);
      await k.idle(); await p.keyboard.press("Escape").catch(() => {});
    } },

  { name: "10-ai-and-automation", kicker: "Chapters 11 and 12", title: "AI assistants and automatic check-ins", sub: "Plan and check in by chat, or from other systems",
    start: "/mcp",
    async run(k) {
      const p = k.page;
      await k.say("Open MCP access to connect Claude, ChatGPT, Gemini, Cursor and others. Pick the app you use.");
      await k.click(p.getByRole("button", { name: /^Claude\b/ }).first(), 2000);
      await k.say("Each app has its own steps, with the server address to copy. Apps that sign in ask you to log in and click Allow.");
      await k.wait(2500);
      await k.say("Other apps use a personal access token. Create one, and copy it right away: it's shown only once.");
      await k.go("/mcp", 2000);
      await k.click(p.getByRole("button", { name: "New token" }), 1000);
      await k.type(k.dialog().locator("input").first(), "Claude Code on my laptop");
      await k.idle(); await p.keyboard.press("Escape"); await k.wait(600);
      await k.say("Then just chat. Say, ran twelve kilometres today, and the assistant checks in and replies with your progress.");
      await k.say("Numbers can also arrive automatically, from a script or a tool like Zapier. Open the metric, and find Automatic check-ins.");
      await k.go(`/metrics/${ids[`metric:${METRIC}`]}`, 3000);
      await k.scrollTo(p.getByText("Automatic check-ins").first(), 1200);
      await k.say("Create a token, and the other system posts each value to the metric's address. Revoke turns it off.");
      await k.hl(p.getByRole("button", { name: /Create token/ }).first(), 2000);
    } },

  { name: "11-account-and-administration", kicker: "Chapters 13 and 14", title: "Your account and administration", sub: "Password, data, email, and the system console",
    start: "/dashboard",
    async run(k) {
      const p = k.page;
      await k.say("Your initials, top right, open the user menu.");
      await k.click(p.getByLabel("Account menu for Alex Rivera").last(), 2000);
      await k.say("My account changes your password, downloads your data, or deletes your account.");
      await k.go("/account", 3000);
      await k.say("Email preferences turns each kind of email on or off. Changes save straight away.");
      await k.go("/email/preferences", 3000);
      await k.say("Administrators also see System console. Status shows whether reminders are being sent.");
      await k.go("/system/status", 4000);
      await k.say("Settings decide who can sign up, password rules, limits, and an announcement for everyone.");
      await k.go("/system/settings", 4000);
      await k.say("Users lets you invite people, disable or unlock an account, send a password link, or view the app as that user.");
      await k.go("/system/users", 2500);
      await k.type(p.getByPlaceholder(/Search/).first(), "northwind", 2000);
      await k.click(p.locator("tbody tr").filter({ hasText: "alex@northwind" }).first(), 3500);
      await k.say("The audit log, email log and insights are in the same console. Back to GoalNexa returns to the app.");
    } },
];

// Make every narration clip first, so text-to-speech latency never shows
// up as a pause in the recording.
const chosen = episodes.filter((ep) => !only || only.some((o) => ep.name.startsWith(o)));
const SAY = /k\.say(?:All)?\(/g, LITERAL = /k\.say(?:All)?\("((?:[^"\\]|\\.)*)"\)/g;
const lines = chosen.flatMap((ep) => {
  const src = ep.run.toString(), found = [...src.matchAll(LITERAL)];
  // Only a plain "..." line can be made ahead; any other would pause the take.
  if (found.length !== [...src.matchAll(SAY)].length) console.log(`warning: ${ep.name} has a k.say() that isn't a plain "..." string - it's voiced mid-recording`);
  return [`${ep.title}. ${ep.sub}`, ...found.map((m) => JSON.parse(`"${m[1]}"`))];
});
console.log(`narration: ${TTS}, ${lines.length} lines`);
for (let i = 0; i < lines.length; i += 4) await Promise.all(lines.slice(i, i + 4).map(speech));

for (const ep of chosen) {
  await film({ out: OUT, ...ep }, ep.run);
}
