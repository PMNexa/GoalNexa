# GoalNexa: Features &amp; Roadmap

Last updated: 2026-10-24. Saved from the "GoalNexa: Features &amp; Roadmap"
doc ([https://claude.ai/artifact/FgFt1UZsxgEmKTo554rxX5](https://claude.ai/artifact/FgFt1UZsxgEmKTo554rxX5), 2026-10-01).
**This file is the source of truth for item status.**

## How approval works

Every roadmap item has an ID, a one-line requirement and a status.
Nothing is implemented until its status is `Approved`.


| Status        | Meaning                                     | Set by |
| ------------- | ------------------------------------------- | ------ |
| `Proposed`    | Requirement drafted, waiting for a decision | agent  |
| `Approved`    | Requirement accepted, ready to implement    | owner  |
| `In progress` | Being implemented                           | agent  |
| `Done`        | Implemented, tested, merged (date in Notes) | agent  |
| `Deferred`    | Not now; stays on the list                  | owner  |
| `Rejected`    | Won't do                                    | owner  |


To approve: change the Status cell to `Approved` (or say "approve P-01,
P-02"). Edit the Requirement cell first if the scope should differ - the
requirement as written when approved is what gets built. An item too big
for one line gets a full spec in `docs/requirements/<ID>.md` before it
moves to `In progress`.

## Summary

GoalNexa ships as two editions from one codebase: a free, self-hosted
public version and a hosted Cloud version. Both carry the same product;
Cloud adds what running it for strangers needs - plans, billing, managed
email, backups and operations.

- **GoalNexa (public)** - source-available under PolyForm Shield, run
with one `docker compose up`. For individuals, homelabs and teams that
want to own their data.
- **GoalNexa Cloud** - the same app at a hosted URL, built from the
private `goalnexa-cloud` fork, which merges the public repo and only
adds files (billing, plans, extensions).

The split rule: anything a self-hoster could use (security, admin,
integrations) goes in the public version; Cloud keeps only what exists
because we operate it for others. The positioning for both: goals,
metrics and check-ins that stay current - updated by people, scripts and
AI agents - with an honest view of what's on track. The category line
under it: "OKRs and KPIs for teams, goals for you" (never MBO); the app
keeps its own words (goal, metric, check-in) and the docs map them.

## Feature list (shipped)

Live in both editions. Status of every row: `Done`.


| Area                  | Features                                                                                                                                                                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Goals and metrics     | Goals and sub-goals; metrics with a start, target and unit (including targets that go down); sub-metrics; metrics that are readings or running totals ("ran 12 km"); check-ins with notes and backdating                                                                               |
| Dashboard             | Progress over time per metric; current progress; projection to the target date; health (on track, at risk, off track, achieved); goal tree with create, check-in and "due" markers; detail drawer                                                                                      |
| Keeping goals current | Check-in schedules (daily, weekly, monthly); reminders by email or 80+ services via Apprise; per-metric ingest URL for scripts, Home Assistant, n8n, CI; daily or weekly digest                                                                                                        |
| Team rhythm           | Organizations with owner/admin/member roles; emailed invitations; private goals with members; cycles (quarters) with close, 0-1 scoring, retro and rollover; activity feed; comments; who logged each check-in (person, AI agent, script)                                              |
| AI assistants         | MCP server for every resource (Claude connector sign-in via OAuth, personal access tokens for other clients); agent skills for check-in, planning and weekly review; AI-first onboarding                                                                                               |
| Administration        | Roles and permissions; System settings (editable or locked by the environment); Status page; audit log; email and notification logs; all organizations with per-org limits; user invite, disable, sessions, password link, read-only "view as", export and delete; announcement banner; account lockout and password rules; single sign-on (OpenID Connect) |
| Your data             | Download all my data (JSON); delete my account                                                                                                                                                                                                                                         |
| Platform              | REST API with filters, search and sideloading; schema-driven screens for every resource; SQLite or Postgres; Docker Compose and Docker Swarm deployments                                                                                                                               |


## Public vs Cloud

The product is the same; the editions differ in who runs it, what's
limited and what's included around it. Rows marked *(planned)* aren't
built yet - they are roadmap items below.


|                   | GoalNexa (public)                                  | GoalNexa Cloud                                                |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| Price             | Free                                               | Free, Pro, Team, Business plans, monthly or yearly (C-02)      |
| License           | PolyForm Shield (source-available)                 | Hosted service                                                |
| Who runs it       | You: Docker Compose, your server, NAS or VPS       | Us: DigitalOcean, Docker Swarm, managed Postgres              |
| First account     | Becomes the admin (first-run setup)                | Regular signup; operator admins only                          |
| Sign-up           | Open by default; invite-only or closed in Settings; optional single sign-on | Open with email verification                                  |
| Email             | Bring your own SMTP (`EMAIL_URL`)                  | Included *(provider not configured yet, C-01)*                |
| Reminder services | Any Apprise service, webhooks, email               | Fixed-host services (Telegram, Slack, Discord, ...) and email |
| Limits            | None by default                                    | Goals, owned orgs and members per plan (C-03)                 |
| Updates           | Pull, rebuild, migrate                             | Continuous, rolling, zero-downtime                            |
| Backups           | Yours                                              | Managed database backups                                      |
| Support           | GitHub issues                                      | Email support, by plan *(planned)*                            |


## Roadmap: public version

Safe to run on the open internet first, then data portable and visible,
then plugged into the tools teams already run. Built in this repo
(`PMNexa/GoalNexa` and the `platform-*` modules).

### Now - Q4 2026 - Run it safely


| ID   | Item                     | Requirement                                                                                                                                                                                       | Status      | Notes                                                                                                                                                  |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P-01 | Two-factor login         | TOTP (authenticator app) per account, with recovery codes; enrol/disable on "My account"; an admin setting can require it for everyone; an admin can reset a user's 2FA                           | Proposed    |                                                                                                                                                        |
| P-02 | Lockout + password rules | Lock an account after N failed logins for M minutes (both System settings), audited; password minimum length and common-password check on signup, reset and change                                | Done        | 2026-10-02. Defaults: 10 attempts, 15 minutes                                                                                                          |
| P-03 | Health checks + alerts   | Unauthenticated `/api/v1/health` (database, scheduler heartbeat, email outbox) for uptime monitors; the scheduler alerts admins (email/Apprise) when a job goes silent or deliveries keep failing | In progress | 2026-10-05: `/api/v1/health` (database only) is live and every healthcheck probes it. Left: scheduler heartbeat and email outbox in it, and the alerts |
| P-04 | Data retention cleanup   | System settings for how long to keep audit events, sent emails, delivery attempts, activity and goal snapshots; a scheduler job deletes older rows; default = keep forever                        | Done | 2026-10-09. System > Settings > Data retention: audit log, email log, notification log, goal activity feeds, daily goal snapshots, Insights history; daily job (`data_retention` on Status) |
| P-05 | SSO (OpenID Connect)     | "Sign in with <provider>" from one OIDC issuer configured by env/settings (Google, Authentik, Keycloak, ...); links to an existing account by verified email; can disable password login          | Done        | 2026-10-02. Q-2: public. Setup: docs/sso.md                                                                                                            |


**Gate: v1.0 release** - an upgrade from an older install and a backup
restore are both tested.


| ID   | Item                           | Requirement                                                                                                                                                | Status   | Notes                        |
| ---- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------- |
| P-06 | v1.0 gate: upgrade path tested | CI job that installs the oldest supported release, seeds data, upgrades to HEAD and runs the suite; documented upgrade steps; version tags and a changelog | Done | 2026-10-02. Baseline: commit 6bdf9bc5 until v1.0.0 is tagged; restore half waits for P-07 |


### Now - Q4 2026 - Use it from your assistant

Early feedback: a user sets up on the website, then checks in only by
chat, from a phone, and stops opening the site. These make that path
work end to end - connect, plan, check in, get reminded, invite -
without the website. Listed in priority order; all live in
`platform-mcp` and goalnexa's skills, so both editions get them.

| ID   | Item                             | Requirement                                                                                                                                                                                  | Status   | Notes                                                                 |
| ---- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------- |
| P-17 | Sign up inside the connect flow  | Someone with no account who connects an assistant (OAuth) is taken through signup, and email verification if on, to the consent page and back to the assistant; tested from a phone browser    | Done | 2026-10-02. The confirmation email's link now carries `next`; run end to end in a phone-sized browser (hosted mode, email verification on) |
| P-18 | Good replies with no skills      | The MCP server's own instructions carry the check-in / plan / review guidance (progress, pace, days left, next actions), so a client with only the connector answers as well as one with the skills | Done | 2026-10-02. `goalnexa/mcp_instructions.md`, served by platform-mcp. Checked with a real client, connector only, Vietnamese prompt |
| P-19 | Choose which resources are tools | A setting lists the resources exposed over MCP; default for GoalNexa: goals, metrics, check-ins, cycles, comments, activity, orgs and invitations - not users, roles or permissions             | Done | 2026-10-02. `MCP_RESOURCES` (61 tools, was ~80). **Action needed** for admins using user/role tools: `MCP_RESOURCES=*` |
| P-20 | Check-in source on Status        | Status shows the share of check-ins by web, AI agent and ingest over 7 and 30 days                                                                                                             | Done | 2026-10-02. 7 and 30 days, counts and shares |
| P-21 | Reminders set up by chat         | MCP tools to read and change the caller's own reminder settings (schedule, digest, where to send); the planning skill offers it after creating a goal                                           | Done | 2026-10-02. `reminder_settings_get/_update/_test`; `PATCH reminder-settings`. Plan skill offers it |
| P-22 | Dashboard link in replies        | Check-in and review replies end with a link to the goal on the dashboard; the dashboard reads well on a phone                                                                                   | Done | 2026-10-02. `/dashboard?goal=<id>` opens on that goal; checked on a phone viewport. No wizard for a user who already has goals |
| P-23 | Any language by chat             | The skills and server instructions say to answer in the user's language; tested with Vietnamese prompts                                                                                        | Done | 2026-10-02. Rule in the instructions and the three skills; check-in tested in Vietnamese, plan and review not |
| P-24 | Invite by chat                   | The plan and review skills offer to invite teammates when a goal belongs to an org, through the existing `org-invitations` tools                                                               | Done | 2026-10-02. In the plan and review skills and the instructions; not yet run with a real client |
| P-25 | Chart in the chat                | A tool returns a goal's progress chart as an image or a data series the assistant can draw                                                                                                     | Done | 2026-10-02. `goals_chart` returns the data series; the assistant draws it. No image |
| P-26 | Public dashboard link | Share the dashboard's shown goals (up to 8) as a public, read-only, live link - no login, no notes or authors; each link revocable | Done | 2026-10-05. Asked for directly. `/shared/<token>`; goals the sharer can no longer see drop off the link |
| P-27 | Tracked-only metrics | A metric with no target (target = start) is charted by its own values instead of a %, and counts toward nothing (progress, projection, health) | Done | 2026-10-07. Asked for directly. One value chart per metric under the goal's % chart; "Tracking" badge on a goal with only those |
| P-30 | Manual order + drag and drop | Goals, sub-goals, metrics and sub-metrics keep an order the user sets by dragging rows in the dashboard tree and the check-in table, within the same parent | Done | 2026-10-09. Asked for directly. `position` + `POST goals|metrics/reorder`; moving under another parent stays in the edit form |
| P-35 | Pick goals in the check-in table | The check-in table shows only the goals picked (several at once, each with its sub-goals); none picked = all; remembered per organization | Done | 2026-10-10. Asked for directly. `GoalPicker` beside "New goal"; columns follow the shown goals' check-ins |

#### Connect guides, client by client

Asked for directly (2026-10-10), after connecting Gemini's web app took
trial and error. Getting connected is where the agent path is lost: each
client hides MCP in a different menu, some sign in with OAuth and some
need a token, and some have eligibility rules (Gemini web: US, 18+,
personal account, Keep Activity on). Order: one source of truth first,
then the wizard and its live check, then measurement, then media. Media
of third-party screens goes stale whenever a vendor redesigns, so text
plus our own "it worked" check carries the guide. Screenshots and video
come last, only for the chat apps where non-technical users start.

| ID   | Item                              | Requirement | Status   | Notes |
| ---- | --------------------------------- | ----------- | -------- | ----- |
| P-36 | One guide source per client       | `MCP_CLIENTS` grows into the single record per client: group (chat app / IDE / CLI), sign-in (OAuth or token), where it works (web, desktop, phone), eligibility, steps (each with an optional image), how to check it worked, known problems and a "last checked" date. Adds Gemini (web) and ChatGPT. The README's client section is generated from it (a script plus a CI check that fails when they differ) | Done | 2026-10-10. `lib/clients.ts` records; README section generated (`npm run readme`, checked in platform-mcp CI). Step images from P-40. Claude, ChatGPT and Gemini steps checked 2026-10-10 (Claude: up to Add) |
| P-37 | Connect wizard with a live check  | The `/mcp` page and the onboarding "AI agent" path become a wizard: pick your app (icons, grouped, most popular first), then one step per screen with copy buttons, then "Waiting for <app>..." that turns into "Connected" once the server sees that client register or call a tool (polls the existing connected-apps data), then a first prompt to try ("How are my goals doing?") | Done | 2026-10-10. All steps on one screen (users flip to the other app and back), not one per screen. Live check polls connected apps + tokens; checked with a real token in a browser, not yet with a real OAuth client. The live check replaces "how to check it worked" for users: they don't need to know where each client lists its servers |
| P-38 | Public connect pages              | `/connect` and `/connect/<client>` work signed out, built from the same records (P-36), with the instance's own URL filled in. They are linkable from the README, the docs, support replies and the server's MCP instructions | Proposed | For people deciding whether to sign up, and for sending someone the steps for one client |
| P-39 | Connect funnel on Insights        | Per client: guide opened, OAuth client registered or token created, first tool call, first check-in by an agent. A "This step didn't work" link on each step records the client and step (`count`, no free text) | Proposed | Shows which client's guide needs work first; feeds P-40/P-41 priorities |
| P-40 | Screenshots for chat apps         | Annotated screenshots for each step of Claude (web), ChatGPT and Gemini (web), stored under `docs/media/connect/<client>/` and shown in the wizard and the public pages. Our own screens (consent, connected) are captured by script from the demo account (`seed_demo.py`) so they never go stale | Done | 2026-10-10 (asked for directly). Image per step in the wizard and README, `consent.png` and `chat.png` (a neutral chat around a real exchange, shown with "Connected") by script (`npm run screens`), `annotate_shot.py`, shot list in platform-mcp `docs/connect-screenshots.md`. Claude's 4 shots taken 2026-10-10 in a browser the user signed in to (Claude had moved connectors to Customize; steps updated). ChatGPT's and Gemini's taken the same day (ChatGPT: Plugins → Add custom MCP server, no developer mode, works on Free; Gemini: no US-only limit seen). ChatGPT's steps run end to end by the user the same day. Third-party screens are captured by hand; each image carries its "last checked" date |
| P-41 | Short videos for top clients      | A 30-60 second silent captioned clip (mp4 + gif) per top client from P-39's numbers, from "open settings" to the first check-in; embedded on its public page | Proposed | Only after P-37 and P-40 are stable: re-recording costs the most |
| P-42 | Guide freshness check             | A monthly checklist (in `docs/`) to run every client's guide end to end and update its "last checked" date; a guide not checked for 90 days shows "may be out of date" | Proposed | Vendors move MCP settings often (Gemini added custom apps in June 2026) |


### Next - Q1 2027 - Know how it's used

Admins see how the instance is used and how well it runs, not just
whether it runs. Today Status shows snapshots only, and "active" means
"logged in", which misses chat users (MCP) and slid sessions. A new
`/system/insights` console page (Status stays "is it running"), fed by
each module through a time-series provider like `register_usage_provider`.
Aggregates only, nothing sent to third parties. Listed in build order.

| ID   | Item                        | Requirement                                                                                                                                                                                                                          | Status   | Notes                                                                                                 |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------- |
| P-28 | Real active users           | `last_seen_at` per user, updated (at most hourly) on token refresh, MCP calls and check-ins; DAU / WAU / MAU, stickiness (DAU/MAU) and active by channel (web only, agent only, both); "engaged" = a check-in in 7 days              | Done | 2026-10-09. `UserPresence.last_seen_at` + one `UserDay` per active day (sign-in/refresh, MCP tool calls, check-ins), hourly-gated; Status's "Signed in" rows are now "Active" |
| P-29 | Daily snapshots + trends    | `goalnexa_jobs` writes one row of system counts per day (users, active, orgs, goals, check-ins, ...); Insights overview: tiles with change vs the previous period and sparklines; 7/30/90-day range; CSV export                      | Done | 2026-10-09. `/system/insights`; modules register `InsightSeries`; backfilled 90 days on first run |
| P-31 | Activation funnel + source  | Signup -&gt; email confirmed -&gt; first goal -&gt; first metric -&gt; first check-in -&gt; check-in in week 2: conversion and median time per step, split by signup source and onboarding choice (website / AI agent)               | Done | 2026-10-09. Source from the `auth.signup` audit event (assistant, `?ref=`, SSO, website); onboarding choice stored (`/api/v1/onboarding-choice`). Week 2 counts accounts 14+ days old |
| P-32 | Retention cohorts           | Weekly signup cohorts x weeks since signup, % still active; lists of users and orgs gone quiet (active before, nothing in 14 / 30 days)                                                                                              | Done | 2026-10-09. Activity = `UserDay` plus check-ins written (so cohorts have history before P-28) |
| P-33 | Feature adoption + top orgs | % of active users using cycles, comments, share links, ingest, digest, reminders, MCP, SSO; goal outcomes (achieved vs abandoned, cycle scores); reminder -&gt; check-in lag; top orgs and users by activity, orgs near their limits | Done | 2026-10-09. Reminder lag = first check-in within 7 days of a reminder |
| P-34 | Quality metrics             | API requests, p50/p95 latency and error rate per endpoint; MCP calls, errors and top tools; email/Apprise success rate per day; scheduler run time; failed logins, lockouts and rate-limit hits; database size                       | Done | 2026-10-09. `RequestMetricsMiddleware` (method + URL pattern, never ids), latency histograms, MCP tool counts, 429s, job run time; database size live |


### Next - Q1 2027 - Bring people back (lifecycle email)

Emails GoalNexa sends on its own initiative to move each user along
signup -> first check-in -> weekly habit -> team -> paid, and to win
back the ones who drift. Built in-house on the existing outbox and
scheduler (behavior data stays on the server); off by default when
self-hosted, on in `saas` mode; click tracking only, no open pixel;
English first. Design: `docs/lifecycle-email.md`. Listed in build order.

| ID   | Item                            | Requirement | Status   | Notes |
| ---- | ------------------------------- | ----------- | -------- | ----- |
| P-43 | Lifecycle email: foundation + onboarding | Email preferences by category (My account) and a signed-out unsubscribe page; one-click `List-Unsubscribe` headers; SES bounces/complaints via SNS into a suppression list every send checks, counted on Status; a journey engine (journeys in code, scheduler in `goalnexa_jobs`, idempotent sends, frequency cap 2/7 days, quiet hours in the user's timezone, 10% holdout); the onboarding journey (welcome by onboarding choice, first goal, first check-in, go mobile, first week; ends at the first check-in); console per-step counts | Done | Built: `platform_lifecycle` + `goalnexa/lifecycle.py` + `config/lifecycle.py`. SES events need a configuration set + SNS topic (docs/deployment.md step 9). Cloud's privacy page needs a lifecycle-email paragraph |
| P-44 | Lifecycle email: engagement     | Habit (milestones at 50% / 100% / 4-week streak, one feature tip a week for unused features, weekly digest on by default for new users), team (invite a teammate after 2 active weeks; owner summary when members go quiet), win-back at 7 / 14 / 30 / 60 days then sunset | Done | Built; team journeys in the host (`config/lifecycle.py`) |
| P-45 | Lifecycle email: measurement    | Each step's target action within 72h stamped as a conversion, compared with the holdout; the messages a user got on their page in the console | Done | Built: System > Lifecycle email (lift vs. holdout), the panel on a user's console page |
| P-46 | Broadcasts + newsletter         | Compose, segment, preview and schedule a broadcast from the console; "Product news" opt-in; lifecycle and broadcasts from their own sending subdomain and SES configuration set | Proposed | Depends on P-43 |
| P-47 | Lifecycle email in other languages | Templates per language, chosen from the user's language; Vietnamese first | Proposed | With P-16 |


### Next - Q1 2027 - Own and share your data


| ID   | Item                    | Requirement                                                                                                                                                                          | Status   | Notes                    |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------ |
| P-07 | Backup and restore      | `manage.py backup` / `restore` (one archive: database dump + settings), scheduled backups to a local path or S3-compatible bucket, last backup shown on Status; restore tested in CI | Proposed | Needed for the v1.0 gate |
| P-08 | Open export format      | Documented, versioned JSON/CSV export of an org (goals, metrics, check-ins, cycles, scores, comments) that an import can read back losslessly                                        | Proposed |                          |
| P-09 | Import from CSV, Notion | Import goals/metrics/check-ins from CSV with column mapping and a preview before writing; Notion via its CSV export                                                                  | Proposed |                          |
| P-10 | Progress badges, embeds | Per-goal opt-in public link: SVG badge (progress %, health) and an embeddable read-only chart; revocable token, no login                                                             | Proposed | P-26 covers a read-only live link to a dashboard; left: per-goal SVG badge and an iframe embed |
| P-11 | Homepage widget         | JSON endpoint + ready-made configs for Homepage / Homarr / Dashy showing goals and progress                                                                                          | Proposed |                          |


### Next - Q1 2027 - One goal system, many teams

Several departments/teams running the same goals and metrics, each with
its own targets and check-ins, and totals at every level - without
copying goal trees by hand. A template owns the shape (goals, sub-goals,
metrics), pushed automatically; each team's instance owns its numbers;
rollups sum them up the team tree. Design: `docs/team-templates.md`.
Listed in build order.

| ID   | Item                 | Requirement | Status   | Notes |
| ---- | -------------------- | ----------- | -------- | ----- |
| P-48 | Teams                | Teams inside an org as a tree of any depth (a department is a team with children); team membership with lead/member roles, managed by org owner/admin; `Goal.team_id`; team filter on the dashboard | Done | 2026-10-12. platform-org `Team`/`TeamMembership`; `team_removed`/`team_changed` signals in platform-core; Organizations > Teams pages with a members panel |
| P-49 | Goal templates       | A template (org owner/admin only) is a goal tree with metrics; "apply to teams" (leaf or middle) creates one linked instance per team; template-owned fields (titles, metric name/unit/aggregation/schedule, structure) are locked in instances; template edits are pushed to every instance automatically (removed items with check-ins are detached, not deleted; aggregation can't change once there are check-ins); teams may add local sub-goals and metrics | Done | 2026-10-12. `goalnexa/templates.py`; generic pages under Goal tracking > Goal templates; apply from the team board (Targets) |
| P-50 | Team board           | One grid per template and cycle: team tree rows x goal/sub-goal/metric columns; Check in mode (one input per cell, due clock, progress heat, notes, saved in one `POST check-ins/bulk`) and Targets mode (base/target per team, planned target on totals, apply to teams, "needs target" badges); cells editable only for the team, its lead, the instance owner and org owner/admin | Done | 2026-10-12. `TeamBoardScreen` at `/board`; `GET goal-templates/<id>/board`, `POST .../targets`, `POST check-ins/bulk`. Phones: the grid scrolls sideways (no card view); no spreadsheet paste yet |
| P-51 | Rollups              | A read-only rollup goal tree per team node and for the org, computed from every instance in the subtree (never from child rollups) by each metric's rule (sum / avg / min / none) and stored as synthetic check-ins so charts, projection and health work; a planned (top-down) target on any node, set by org owner/admin or a team lead below their team, shown against the teams' sum with the gap; next cycle's targets start blank | Done | 2026-10-12. `goalnexa/rollups.py`; totals titled "<goal> · <team> total"; one synthetic check-in per day |
| P-52 | Team-aware check-ins | An assistant's check-in goes to the instance of the speaker's team; in several teams, it asks which; rollup metrics refuse check-ins | Done | 2026-10-12. `in_my_team`/`is_total` on metrics; MCP instructions, check-in and review skills. Not yet re-run with a real client |
| P-53 | Team visibility      | A `team` goal visibility: only the team's subtree and org owner/admin see the instance; it still counts in its ancestors' totals | Done | 2026-10-12. Team-only visibility includes leads of teams above (they set those targets) |
| P-91 | Team board: down to members | A team's lead (or a lead above, or an org owner/admin) gives team members their own copy of the team's goals in Targets mode - a row per member under the team's, ticked to give, unticked to take away (a copy with check-ins detached, an empty one deleted); the lead sets each member's start and target, the member checks in on their own row only (the rest of the team can't); the member owns their copy, so reminders, the digest and the dashboard are theirs; the team keeps its own copy and its total is its copy plus its members' (any team with member copies is totalled), counted up the tree like any instance; rollover keeps member copies; an assistant checks in on the user's own copy first (`for_me`) | Done | 2026-10-27. Asked for directly. `Goal.assignee_id`; `POST goal-templates/<id>/assign`/`unassign`; board `teams[].people`/`can_assign`, `members`, `names`. Whole template per member (no picking goals); a member who leaves the team keeps their copy (shown as theirs on the board) |


### Next - Q1 2027 - Quotas per period (daily, weekly, ...)

Metrics whose target is per period - "10 calls a day", "3 workouts a
week" - where the goal counts either the total ("900 this quarter") or how
often the quota is hit ("every day"), per metric. Periods: day, week,
month, quarter, year. Design: `docs/period-targets.md`. Listed in build
order.

| ID   | Item                    | Requirement | Status   | Notes |
| ---- | ----------------------- | ----------- | -------- | ----- |
| P-54 | Organization time zone  | An organization has a time zone (IANA), set by its owners/admins, defaulting to the creator's browser zone; a day starts there for every goal of the org (personal goals: the owner's zone) | Done | 2026-10-12. `Organization.timezone` (validated IANA name, editable on the org page); new orgs from the onboarding wizard get the browser's zone. Blank = the goal owner's zone, else UTC |
| P-55 | Pace for running totals | For a sum metric: what's needed per day/week to reach the target by the target date, and the amount checked in this period, on the board, the dashboard and in the assistant's replies; the dashboard can show bars per period with the running total | Done | 2026-10-12. `pace` on every metric (`goalnexa.periods.pace_hint`): per day/week to land on target; on the board and to the assistant; bars per period from the dashboard's "Show check-ins by" |
| P-56 | Targets per period      | A sum metric's target can be per day, week, month, quarter or year (or the whole goal, the default), counting every day or weekdays only; the server derives this period's value, the cumulative target (quota x counted periods, prorated), expected so far and pace health; goal progress uses the cumulative target, so totals and charts keep working; goal templates and the template wizard carry the fields; team totals add the quotas up | Done | 2026-10-12. `Metric`/`TemplateMetric` `target_per`, `count_days`, `progress_by`; `goalnexa/periods.py` (stored `period_value`, `cumulative_target`, `expected_value`); recomputed by `goalnexa_jobs` every run |
| P-57 | Hit rate and streaks    | A period metric's progress can be how often the quota is hit instead of the total: hit rate (periods hit / periods so far) and current streak, stored for agents and filters; health from the hit rate; team totals average the teams' rates or take the lowest | Done | 2026-10-12. Stored `hit_rate`/`streak`; a 100% hit rate isn't "achieved" before the goal ends |
| P-58 | Period views            | The board shows a period metric's current period large ("Today 6/10") with the total or hit rate and streak; the dashboard draws bars per period against the quota line, and can show any reading metric snapped to a period (its last reading in each day/week/month/quarter/year, display only); an end-of-period reminder when the current period is under quota; the assistant's check-in and review skills report period value, what's left, hit rate and streaks | Done | 2026-10-12. Board cells, dashboard bars + "Show check-ins by" snap, tree shows this period, end-of-period nudge from 18:00 local on a period's last counted day, skills updated (not re-run with a real client). Client bars count in the browser's zone, without proration |
| P-59 | Add a team from the board | In the team board's Check in mode, a team that doesn't use the template has an "Add" button (organization owners and admins), not only the tickbox in Targets mode | Done | 2026-10-12 |
| P-60 | One reading per period  | A metric can keep one reading per day, week, month, quarter or year (`Metric.one_per`, blank = every check-in counts): every check-in is kept, but only the last one in each period (by `checked_in_at`, in the goal's zone; same time = the later saved) counts. A reading metric: no change to its value, its series has one point per period. An amount metric: each check-in is "the period's total so far" - the running total, period value, hit rate and streak add up the last check-in of each period. Goal templates carry it (locked in team copies); changing it recomputes the history | Done | 2026-10-12. `Metric.one_per`/`TemplateMetric.one_per`, `CheckIn.replaced` (kept by `refresh_metric`); `goalnexa.periods.counted`/`replaced_by`; a single check-in's response carries `replaces` |
| P-61 | Replaced check-ins in the UI | The check-in form says when it replaces one ("Replaces today's 8,000 (09:12)", prefilled); check-in lists, the activity feed and chart tooltips show replaced check-ins greyed as "replaced"; the dashboard's "Show check-ins by" defaults to the metric's period (a coarser one can still be picked) | Done | 2026-10-12. Check-in form: "Replaces today's 8,000 (09:12)", prefilled, warns when a later one in that period keeps counting; feed: "replacing 8,000"; board cells: "total today"; dashboard snaps the metric to at least its period - so replaced check-ins aren't drawn and tooltips have none to grey; the generic check-in list shows a Replaced column. Client buckets count in the browser's zone |
| P-62 | Replacing check-ins by assistant | The MCP instructions and the check-in skill send the period's total for such a metric (not the difference) and reply with what it replaced ("8,000 -> 10,500 today, replaces the earlier one"); the review skill reads the counted values | Done | 2026-10-12. MCP instructions, check-in, plan and review skills. Not yet re-run with a real client |
| P-63 | Check-ins for a period  | A metric's check-ins can be for a whole day, week, month, quarter or year (`Metric.snap_to`, blank = any time): the server sets every check-in's time to its period's first day (00:00, the goal's zone) from every source - web, team board, assistant, ingest; changing it moves existing check-ins; it can't be longer than the target's period or the one-reading period; templates carry it (locked). The check-in form asks for the period instead of a time; the board's cells say which period; the assistant logs "last week" by sending a time inside it | Done | 2026-10-12. Snapping is in `CheckIn.save` (`periods.snap_time`); `periods.resnap` on a change. Whether a second check-in in a period replaces or adds is still `one_per` |
| P-64 | Check-ins for a period, per goal | A goal has the same "check-ins are for" setting (`Goal.snap_to`); its metrics follow it live ("Same as goal", the default), or pick their own; changing it moves the following metrics' check-ins; refused when a following metric's target or one-reading period is shorter | Done | 2026-10-13. `Metric.snap_to_goal` (API `snap_to: "goal"`); stored `snap_to` stays the period in effect (`snap_period`), so readers and the previous release need no lookup; `periods.follow_goal`; template/total metrics never follow |
| P-65 | Teams org chart | Organizations > Teams as an org chart (org on top, teams as cards with their lead(s) and members, sub-teams below, collapsible), with the list one click away; org owners/admins create, rename, move and delete teams and add, promote and remove members on the chart | Done | 2026-10-13. platform-org `TeamChartScreen` (`routes/teams.tsx` as the teams' `listFile`); no API change |
| P-66 | Board: who plays, what adds up | In the team board's Targets mode a tick per team adds it to the template or takes it out (copies with check-ins detached, empty ones deleted), and a tick per department / the org calculates its total (no longer automatic; the org's on by default); Check in mode shows only the teams that run the template, counting the others | Done | 2026-10-14. `GoalTemplate.total_for`; `POST goal-templates/<id>/totals`, `POST goal-templates/<id>/leave`; existing totals migrated as ticked |
| P-80 | When check-ins happen | "Check-ins are for" gets the moment in its period (a day's time; a week's weekday; a month's day; a quarter's month and day; a year's month and day; a time), check-ins are dated at it and - "due at that moment", on by default for new rows - it's when the period's check-in is due and reminded; sub-goals inherit their parent goal's setting, metrics their goal's, sub-metrics their parent metric's; the field sits right under the title/name; "check in every" adds quarterly and yearly | Done | 2026-10-18. `SnapMoment` on `Goal`/`Metric`/`TemplateMetric`, `Goal.snap_to_parent` (API "parent"); `periods.moment`/`due_moment`/`follow_plan`/`apply_follow`. Existing rows: moment = first day 00:00, not due (unchanged) |
| P-81 | Confidence on check-ins | A check-in can carry an optional confidence (low / medium / high, or 1-10) that the person sets; shown next to the forecast on the goal's chart and in the digest, and readable by assistants - what strict OKR buyers look for next to the computed health | Proposed | From the OKR/KPI positioning (2026-10-21). The forecast stays the main status; confidence is the person's view beside it |


### Next - Q1 2027 - Phone apps

Native apps, Android first (Kotlin + Compose), then iOS (Swift). The
server computes everything; the apps only show it. Push goes through a
free relay that serves self-hosted servers too. The apps' source is
private (`goalnexa-cloud`); the server side is here. Design:
`docs/mobile-app.md`. Listed in build order.

| ID   | Item                               | Requirement                                                                                                                                                                                                    | Status   | Notes |
| ---- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----- |
| P-67 | Native app sign-in                 | Login and refresh can return the refresh token in the response body for a native app (single-use rotation unchanged); each device is a session the user and admins can see and sign out                        | Done     | 2026-10-16. `RefreshToken.client`/`device_name`; works on signup, setup and password change too |
| P-68 | SSO for apps                       | SSO from the app: a Custom Tab, PKCE, a `goalnexa://` redirect with a one-time code the app exchanges for tokens                                                                                               | Done     | 2026-10-16. `sso/start?app_redirect=&code_challenge=`, `POST auth/sso/token`, `AppAuthCode` (2 minutes, once); allowed addresses in `PLATFORM_AUTH_APP_REDIRECTS` |
| P-69 | Idempotent check-ins               | A check-in can carry a client reference, unique per author, so a retried request returns the first check-in instead of a duplicate; check-ins from the app have source "mobile"                                | Done     | 2026-10-16. Same reference on another metric: 409; `source` from the `X-GoalNexa-Client: mobile` header; not in `check-ins/bulk` |
| P-70 | Today endpoint                     | `GET me/today`: due metrics, this period's pace per metric and goals at risk in one call, scoped like every list                                                                                               | Done     | 2026-10-16. `GET /api/v1/today` (not `me/today`), `?org=<id>|personal`; open goals only, no totals |
| P-71 | Chart payload                      | Each metric's replayed series and projection from the server, ready to draw, so a client doesn't repeat `lib/progress.ts`                                                                                      | Done     | 2026-10-16. Extends `GET goals/<id>/chart`: manual order, `tracked`, `projection`, `range`, `now` |
| P-72 | App versions                       | `auth/config` carries a minimum app version; the API keeps working for app versions released in the last 6 months                                                                                              | Done     | 2026-10-16. Settings `apps.min_android_version`/`apps.min_ios_version` (env `APPS_MIN_*`); the rule is in AGENTS.md |
| P-73 | Push relay                         | A free relay we run that forwards content-free pushes (FCM, later APNs) for any GoalNexa server, self-hosted included: handles bound to one server, signed server keys, rate limits, pruning (relay in `goalnexa-cloud`, server half here) | Done | 2026-10-22. `goalnexa_push_relay` in `goalnexa-cloud` at `/api/v1/push-relay`, not its own subdomain yet (`push.relay_url`). Sends once the Firebase project is set up (`docs/deployment.md` step 12) |
| P-74 | Push reminders                     | Reminders, end-of-period nudges and the digest can go to the app through the relay; reminder settings choose Apprise, push or both; device rows cleaned up on account deletion and by retention                | Done | 2026-10-22. `ReminderSettings.push` next to Apprise and email; server: `goalnexa/push.py`; Android: built, not yet tried on a device |
| P-75 | Android app v1                     | Kotlin + Compose app (`goalnexa-cloud`'s `apps/android/`): sign in with a server URL, Today, check in, goals and goal detail with charts and activity, organization switch, push, account deletion                                | Approved | 2026-10-16. Built in `goalnexa-cloud` |
| P-76 | Android release                    | CI build, Play internal and closed test (12 testers, 14 days), Data safety form, demo account, production release built from `goalnexa-cloud`                                                                  | Proposed |  |
| P-77 | Android widget, shortcuts, offline | A home-screen widget (today's quotas, tap to check in), app shortcuts, and check-ins queued offline and sent later                                                                                             | Proposed |  |
| P-78 | More push options                  | UnifiedPush on Android (no relay, no Google); opt-in notifications for comments on your goals and health changes                                                                                               | Proposed |  |
| P-79 | iOS app                            | SwiftUI app at parity with the Android one, APNs through the same relay                                                                                                                                        | Proposed |  |


### Later - Q2-Q3 2027 - Fit into your stack


| ID   | Item                  | Requirement                                                                                                            | Status   | Notes                             |
| ---- | --------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------- |
| P-12 | Outbound webhooks     | Per-org webhook URLs for check-in, goal health change, cycle close; signed payloads, retries, delivery log             | Proposed |                                   |
| P-13 | Git/Gitea/GitLab sync | A metric follows a repo number (issues closed, milestone %, releases) via the ingest URL, with setup recipes per forge | Proposed |                                   |
| P-14 | Feature switches      | Admin toggles to turn whole features off (cycles, comments, MCP, ingest, digest) - nav, API and MCP tools follow       | Proposed |                                   |
| P-15 | Org-level audit log   | Org owners/admins see the audit events of their own org (members, roles, goals, cycles), with CSV export               | Proposed |                                   |
| P-16 | Translations          | UI strings extracted, language picker per user, first extra language: Vietnamese                                       | Proposed | Language choice is a guess - edit |


Integrations stay last and stay open (webhooks, ingest URLs), so one
maintainer isn't keeping a dozen connectors alive.

### Ideas - from comparing other OKR tools

Found while writing comparison pages against Viva Goals, Perdoo, Tability,
Weekdone, Quantive (WorkBoard) and Lattice Goals (2026-10-24; sources on each page, `goalnexa-cloud`'s
`/alternatives/*`). Not scheduled - approve or reject each.

| ID   | Item                  | Requirement | Status   | Notes |
| ---- | --------------------- | ----------- | -------- | ----- |
| P-82 | Goal setup hints      | A goal shows hints when its setup weakens the forecast: no metrics, more than 5 root metrics, no target date, no check-in a week after its cycle started; closing a cycle with a score above 0.8 suggests aiming higher next time; the review skill and digest mention them | Proposed | Viva Goals' "Needs attention" indicators |
| P-83 | Stuck at risk         | A goal at risk or off track for 3 check-ins (or 2 weeks) in a row is called out to its owner and the org's admins in the digest and as a reminder, once per spell | Proposed | Tability warns after 3 at-risk check-ins |
| P-84 | Metric weights        | A root metric can weigh 1-4 in its goal's progress (default 1); forecast, health and totals use the weighted mean, server and `lib/progress.ts` alike | Proposed | Weekdone, Viva Goals |
| P-85 | Pulled values         | A metric can read its value on a schedule (hourly/daily) from a URL returning a number or JSON (with a path) or a published Google Sheets cell, as a check-in with source "pull"; hosted: fixed hosts only, like reminder schemes | Proposed | Push ingest exists; Perdoo, Tability, Weekdone pull from Sheets, Jira, HubSpot |
| P-86 | Review deck export    | Export a cycle's or the dashboard's shown goals as a PDF (and PowerPoint) for the review meeting: one page per goal with its chart, forecast, health and latest notes | Proposed | Perdoo (PDF/PPT), Tability (PDF/Slides) |
| P-87 | Slack check-ins       | A Slack app: due-check-in reminders with an inline check-in form, `/goalnexa` to check in or see a goal, the digest to a channel | Proposed | All three have Slack; weigh against "integrations stay last" |
| P-88 | Viewer role           | An org role that sees the org's goals, dashboards and board but can't check in or edit - for leadership and boards | Proposed | Perdoo view-only licences, Tability read-only seats |
| P-89 | Start from a template | A public link (`/start?template=<slug>`) creates a ready-made goal with its metrics, targets and check-in schedule for the visitor - after signup (or login) if they have none yet, then opens it on the dashboard; templates come from one shared list that onboarding uses too | Proposed | Asked for 2026-10-24. **When built: add the "Use this template" button back to `goalnexa-cloud`'s `/templates/<slug>` pages** (`app/extensions/marketing/TemplatePage.tsx`, where a `P-89` comment marks the spot) - they ship without it for now |
| P-90 | Duplicate a goal      | "Duplicate" on a goal copies it with its metrics, sub-goals and their metrics (targets, schedules, check-in settings; no check-ins), into the same or another organization or cycle the user can write to | Proposed | Lattice Goals (duplicate a goal with its children); also the quickest way to reuse last quarter's goals outside a cycle close |

## Roadmap: Cloud version

Something teams can pay for first, then the Business plan, then larger
companies. Built in the private `goalnexa-cloud` fork (extensions only);
seams it needs land here. Cloud also inherits every public release
through the sync, so P-01..P-03 land there before paid launch.

### Now - Q4 2026 - Ready for paying teams


| ID   | Item                   | Requirement                                                                                                                                                     | Status   | Notes                                   |
| ---- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------- |
| C-01 | Email provider live    | Transactional email from our domain (SPF/DKIM/DMARC), `EMAIL_URL` set in the stack, verification/invite/reset/digest mails delivered; bounces visible on Status | Done | 2026-10-10. SES on port 2587 (DigitalOcean blocks 587; Gmail and Brevo tried); test email delivered from production. Out of the SES sandbox (an unverified address was accepted). Sends as `noreply@goalnexa.binhnguyen.org` (domain verified: DKIM, MAIL FROM, DMARC). Bounces/complaints on Status built with P-43 (needs the SES configuration set + SNS topic, `docs/deployment.md` step 9.8). Setup: `docs/deployment.md` step 9 |
| C-02 | Plans + billing        | Free/Pro/Team/Business plans; Paddle checkout and customer portal; signed webhooks keep subscriptions in sync; Billing page; plans edited in the System console | Done | 2026-10-06. Paddle instead of Stripe (Gumroad first, replaced 2026-10-05); prorated amount shown before a switch; `/pay` for Paddle's payment link. Live payments wait for Paddle's approval and setup |
| C-03 | Plan limits per org    | Each plan limits personal goals, owned orgs, and members and goals per owned org; refusal `402 plan_limit` with the pricing link; a downgrade never deletes data | Done | 2026-10-06. A subscription is per user; an org gets its owners' best plan; `BILLING_ENFORCE_LIMITS` turns limits off. See goalnexa-cloud `docs/billing.md` |
| C-04 | Public status page     | Public uptime/incident page on its own host, fed by the health endpoint (P-03)                                                                                  | Proposed | Depends on P-03 (endpoint live, alerts not) |
| C-05 | Signup funnel tracking | Privacy-friendly, cookieless counts: visit -&gt; signup -&gt; verified -&gt; first goal -&gt; first check-in -&gt; paid; shown to operators                     | Proposed |                                         |
| C-21 | Public website | Landing page, pricing, terms, privacy, refund policy and contact pages on the hosted site; a "Use GoalNexa with Claude" guide | Done | 2026-10-05. In `goalnexa-cloud` (`app/extensions/`), mounted through the public-route seam. Legal texts await review before paid launch |
| C-22 | Upgrade emails | The upgrade journey on P-43's engine: at 80% of a plan limit, 1h after a `402 plan_limit`, a Free org with 3+ active members, a welcome after upgrading, a one-question survey after cancelling; an "Offers" email category | Proposed | Depends on P-43, C-02. Design: `docs/lifecycle-email.md` |
| C-23 | OKR and KPI pages | `/okr` and `/kpi` on the hosted site: the method's words mapped onto goals/metrics/check-ins, the shipped features that answer it, linked from the header, footer and landing page; the landing page names the category ("OKRs and KPIs for teams, goals for you") | Done | 2026-10-21. `extensions/okr.tsx`, `kpi.tsx`, `marketing/TopicPage.tsx`; positioning in `marketing/personas/README.md` "Category" |
| C-24 | Comparison pages | One page per competitor buyers name (Perdoo, Tability, Weekdone, a Viva Goals alternative): a fair criteria table, when the other tool is the better pick, verifiable claims, no prices in the text (link to pricing) | Proposed | Before paid launch; AI answers cite comparison pages that admit trade-offs |
| C-25 | Search basics for the public pages | `/robots.txt` and `/sitemap.xml`; a canonical URL on the hosted domain for every public page (the old domain keeps serving them); Open Graph and Twitter share cards with a 1200x630 image; JSON-LD structured data (product on the landing page, FAQ on pricing); every other page - the app, sign-in, shared links - `noindex` | Done | 2026-10-21: live on `goal.pmnexa.com` (canonical URLs and the sitemap name it). Seam in main's `root.tsx`: a route's `handle.indexable` opts it in, so self-hosted instances aren't indexed either |
| C-26 | SES bounces and complaints | Hook SES up to the suppression list built in P-43: an SNS topic `goalnexa-ses-events` (Standard, ap-southeast-1); an SES configuration set `goalnexa` sending Hard bounces + Complaints to it; `EMAIL_SES_CONFIGURATION_SET` and `EMAIL_SES_TOPIC_ARNS` in cloud `.env.production` (re-upload `PROD_ENV`, re-run the deploy); then an HTTPS subscription to `/api/v1/email/ses-events`, raw delivery off, which the app confirms itself; test with the SES simulator's bounce address, which should show under System > Suppressed addresses | Deferred | Operator setup only, no code. Steps: `docs/deployment.md` step 9.8. Until then mail still goes out, but a bouncing address isn't blocked automatically and Status shows no bounces |


**Gate: paid launch** - billing, email and backups verified (a tested
database restore).


| ID   | Item                            | Requirement                                                                                                                   | Status   | Notes |
| ---- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------- | ----- |
| C-06 | Paid-launch gate: restore drill | Restore the managed Postgres backup into a scratch stack, run the suite against it, write the runbook in `docs/deployment.md` | Proposed |       |


Cloud's share of the assistant path (the rest is P-17..P-25):

| ID   | Item                         | Requirement                                                                                                                              | Status   | Notes                                  |
| ---- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------- |
| C-17 | Signup source                | Each signup records where it came from (website, which assistant's connector, `?ref=`), shown in the funnel counts                         | In progress | 2026-10-02 - recorded: the `auth.signup` audit event holds `next` path, OAuth `client_id`, `ref` (public, platform-auth). Showing it waits for C-05, which isn't approved |
| C-18 | Upgrade by chat              | A plan-limit refusal reaching an MCP client carries a message and the billing link the assistant can relay | Done | 2026-10-04. In `goalnexa-cloud`: the refusal states the limit and links `/pricing` (needs `GOALNEXA_PUBLIC_URL`), neutral wording because ChatGPT's app rules forbid upgrade prompts; the server instructions say to relay it |
| C-19 | Assistant directory listings | Listed in the Claude Connectors Directory, then ChatGPT's; whatever each review asks for (test account, policies, support contact) | In progress | Claude: listed at claude.ai/directory/goalnexa, linked from the landing page since 2026-10-05. ChatGPT: plugin submitted 2026-10-04, in review (`docs/directory/chatgpt-plugin/`) |
| C-20 | A reason for Pro besides limits | Decide from beta data what a solo chat user with a few goals would pay for                                                              | Approved | Decision, not code - needs beta data |


### Next - Q1 2027 - Business plan


| ID   | Item                     | Requirement                                                                                           | Status   | Notes                                 |
| ---- | ------------------------ | ----------------------------------------------------------------------------------------------------- | -------- | ------------------------------------- |
| C-07 | SSO, gated by plan       | P-05's OIDC per org, available on Business and up                                                     | Proposed | Depends on P-05 and the open question |
| C-08 | Audit log streaming      | Stream an org's audit events to a webhook/SIEM endpoint; Business and up                              | Proposed | Depends on P-15                       |
| C-09 | Usage metering           | Per-org counts over time (members, goals, check-ins, emails, MCP calls) for limits, billing and abuse | Proposed |                                       |
| C-10 | 3-node high availability | Swarm with 3 managers, replicas spread across nodes, a node loss causes no outage                     | Proposed | Infrastructure cost                   |
| C-11 | Custom branding          | Org logo and accent color in the app shell and emails; Business and up                                | Proposed |                                       |


### Later - H2 2027 - Enterprise


| ID   | Item                    | Requirement                                                                                              | Status   | Notes                       |
| ---- | ----------------------- | -------------------------------------------------------------------------------------------------------- | -------- | --------------------------- |
| C-12 | EU data region          | A second deployment in an EU region; org picks its region at creation                                    | Proposed | Open question below         |
| C-13 | Dedicated instances     | Single-tenant deployment per customer from the same images                                               | Proposed |                             |
| C-14 | SAML and contracts      | SAML 2.0 sign-in; DPA/MSA templates                                                                      | Proposed |                             |
| C-15 | SOC 2 readiness         | Policies, access reviews, logging and evidence collection for a SOC 2 Type I audit                       | Proposed | Mostly process, little code |
| C-16 | Hosted AI weekly review | Server-run weekly review per org (the `goalnexa-review` skill on our API key), delivered with the digest | Proposed |                             |


## Cloud plans

Live since 2026-10-06 (C-02, C-03). Plans are rows in the System console
(Billing > Plans), so these launch values can change without a deploy;
goalnexa-cloud's `docs/billing.md` is the source of truth. The first
hypothesis was flat per organization (Free / Team $29 / Business $99 /
Enterprise); what shipped is a subscription per user, and an
organization gets the best plan among its owners - a team still pays
once.


| Plan     | Price (USD)            | Personal goals | Orgs you own | Members per owned org | Goals per owned org |
| -------- | ---------------------- | -------------- | ------------ | --------------------- | ------------------- |
| Free     | 0                      | 5              | 1            | 3                     | 5                   |
| Pro      | 5 / month, 48 / year   | Unlimited      | 1            | 5                     | Unlimited           |
| Team     | 29 / month, 290 / year | Unlimited      | 3            | 25                    | Unlimited           |
| Business | 79 / month, 790 / year | Unlimited      | 10           | 100                   | Unlimited           |


Only adding is limited. Feature gating by plan (SSO, audit streaming)
is still new work in the Cloud fork; Enterprise is a contract, not a
listed plan.

## Risks, open questions, measures

**Risks**

- Operately reaches the same self-hosted teams first; our answer is AI
agents and goals that stay current, not more project management.
- AI connections (MCP) are becoming standard in OKR tools - Tability,
Perdoo and others ship them - so they're table stakes, not a moat.
- One maintainer: every integration we add is one more thing that
breaks. Prefer open hooks (ingest URLs, webhooks) over per-tool
connectors.
- A public SaaS invites abuse and account attacks before 2FA, lockout
and email verification are live.

**Open questions** (owner decides; each blocks the items named)


| ID  | Question                                                                                                 | Blocks                 | Decision               |
| --- | -------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------- |
| Q-1 | Which email provider for Cloud (Postmark, Resend, SES), and does it send from our domain?                | C-01                   | SES, on port 2587 (DigitalOcean blocks 587) |
| Q-2 | Do any Cloud features stay out of the public version (SSO, audit streaming), or only limits and support? | P-05, P-15, C-07, C-08 | only limit and support |
| Q-3 | Is an EU region needed for the first paying teams?                                                       | C-12                   | yes                    |


**What we measure**


| Measure                                       | Why                                                |
| --------------------------------------------- | -------------------------------------------------- |
| Weekly active teams                           | Core adoption                                      |
| Share of scheduled metrics checked in on time | Whether goals stay current - the product's promise |
| Share of check-ins by AI agents and scripts   | Whether the AI and automation pitch is real        |
| Free to paid conversion (Cloud)               | Willingness to pay                                 |
| Monthly churn (Cloud)                         | Retention                                          |
| Uptime and delivery failure rate              | Trust in reminders and digests                     |
