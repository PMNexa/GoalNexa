# GoalNexa: Features &amp; Roadmap

Last updated: 2026-10-02. Saved from the "GoalNexa: Features &amp; Roadmap"
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
AI agents - with an honest view of what's on track.

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


### Next - Q1 2027 - Own and share your data


| ID   | Item                    | Requirement                                                                                                                                                                          | Status   | Notes                    |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------ |
| P-07 | Backup and restore      | `manage.py backup` / `restore` (one archive: database dump + settings), scheduled backups to a local path or S3-compatible bucket, last backup shown on Status; restore tested in CI | Proposed | Needed for the v1.0 gate |
| P-08 | Open export format      | Documented, versioned JSON/CSV export of an org (goals, metrics, check-ins, cycles, scores, comments) that an import can read back losslessly                                        | Proposed |                          |
| P-09 | Import from CSV, Notion | Import goals/metrics/check-ins from CSV with column mapping and a preview before writing; Notion via its CSV export                                                                  | Proposed |                          |
| P-10 | Progress badges, embeds | Per-goal opt-in public link: SVG badge (progress %, health) and an embeddable read-only chart; revocable token, no login                                                             | Proposed | P-26 covers a read-only live link to a dashboard; left: per-goal SVG badge and an iframe embed |
| P-11 | Homepage widget         | JSON endpoint + ready-made configs for Homepage / Homarr / Dashy showing goals and progress                                                                                          | Proposed |                          |


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

## Roadmap: Cloud version

Something teams can pay for first, then the Business plan, then larger
companies. Built in the private `goalnexa-cloud` fork (extensions only);
seams it needs land here. Cloud also inherits every public release
through the sync, so P-01..P-03 land there before paid launch.

### Now - Q4 2026 - Ready for paying teams


| ID   | Item                   | Requirement                                                                                                                                                     | Status   | Notes                                   |
| ---- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------- |
| C-01 | Email provider live    | Transactional email from our domain (SPF/DKIM/DMARC), `EMAIL_URL` set in the stack, verification/invite/reset/digest mails delivered; bounces visible on Status | Done | 2026-10-10. SES on port 2587 (DigitalOcean blocks 587; Gmail and Brevo tried); test email delivered from production. Not yet: out of the SES sandbox, sending from our domain (a verified gmail address for now), bounces on Status. Setup: `docs/deployment.md` step 9 |
| C-02 | Plans + billing        | Free/Pro/Team/Business plans; Paddle checkout and customer portal; signed webhooks keep subscriptions in sync; Billing page; plans edited in the System console | Done | 2026-10-06. Paddle instead of Stripe (Gumroad first, replaced 2026-10-05); prorated amount shown before a switch; `/pay` for Paddle's payment link. Live payments wait for Paddle's approval and setup |
| C-03 | Plan limits per org    | Each plan limits personal goals, owned orgs, and members and goals per owned org; refusal `402 plan_limit` with the pricing link; a downgrade never deletes data | Done | 2026-10-06. A subscription is per user; an org gets its owners' best plan; `BILLING_ENFORCE_LIMITS` turns limits off. See goalnexa-cloud `docs/billing.md` |
| C-04 | Public status page     | Public uptime/incident page on its own host, fed by the health endpoint (P-03)                                                                                  | Proposed | Depends on P-03 (endpoint live, alerts not) |
| C-05 | Signup funnel tracking | Privacy-friendly, cookieless counts: visit -&gt; signup -&gt; verified -&gt; first goal -&gt; first check-in -&gt; paid; shown to operators                     | Proposed |                                         |
| C-21 | Public website | Landing page, pricing, terms, privacy, refund policy and contact pages on the hosted site; a "Use GoalNexa with Claude" guide | Done | 2026-10-05. In `goalnexa-cloud` (`app/extensions/`), mounted through the public-route seam. Legal texts await review before paid launch |


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
