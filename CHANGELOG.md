# Changelog

What changed in each release, newest first. How to upgrade:
[`docs/upgrading.md`](docs/upgrading.md). Versions are git tags
(`vMAJOR.MINOR.PATCH`); an entry marked **Action needed** asks something
of you beyond the usual upgrade steps.

## Unreleased

### Added

- **Connect wizard for AI assistants.** The "MCP access" page and the
  onboarding's AI agent path now start with "Which app do you use?" -
  Claude, ChatGPT, Gemini, Cursor, VS Code, Windsurf, Claude Code, Codex,
  Gemini CLI and more - then show that app's steps (with who can use it,
  e.g. Gemini's custom apps need a personal Google account) and turn
  "Waiting for <app>" into "Connected" by themselves as soon as the app
  signs in or uses its token. Claude, ChatGPT and Gemini have a
  screenshot for every step, and "Connected" shows a first question
  asked in a chat.
  ChatGPT and Gemini (web) are new.
- **API reference.** Every instance serves its API as an OpenAPI 3
  document at `/api/v1/schema`, browsable at `/api/v1/docs` (Swagger UI)
  and `/api/v1/redoc`: goals, metrics, check-ins, organizations and the
  rest, with their fields, filters, paging and error format.
- **System > Insights.** A new console page shows how the instance is
  used and how well it runs, for the last 7, 30 or 90 days against the
  period before: daily numbers with sparklines (active users, sign-ups,
  goals, check-ins, AI assistant use, API traffic, emails; CSV export),
  active users by channel (website, AI assistant, both), the activation
  funnel by signup source and onboarding choice, weekly retention
  cohorts and people/organizations gone quiet, feature adoption, goal
  outcomes, reminder follow-through, most active organizations, and
  quality (requests, latency and errors per endpoint, MCP tools,
  deliveries, jobs, failed logins, rate limits, database size).
  Aggregates only - nothing leaves the instance. "Active" now counts
  anyone who signed in, kept a page open, used an assistant or checked
  in; Status's "Signed in" rows became "Active".
- **Data retention.** System > Settings > Data retention sets how long
  to keep the audit log, email and notification logs, goal activity
  feeds, daily goal snapshots and Insights history. Default: forever.
- **Order goals and metrics by dragging.** In the dashboard's goal tree
  and the check-in table, drag a goal, sub-goal, metric or sub-metric
  to move it among the others under the same parent; the order is saved
  for everyone. Existing ones start in their old alphabetical order, and
  a metric's chart color follows its place in the list.
- **Collapsible rows in the check-in table** for goals and metrics with
  rows under them.
- **Pick which goals the check-in table shows.** "Goals" next to "New
  goal" lists every goal; tick one or more to see only those (with their
  sub-goals and metrics), or "Show all". Remembered per organization in
  the browser.
- **Organization names in lists.** Generic lists (e.g. Goals) show a
  goal's organization by name instead of its id.
- **Metrics without a target.** A metric whose target equals its start
  value (a KPI you watch rather than a goal) is now charted by its own
  values - one small chart per metric, in its unit - instead of leaving
  the goal's panel saying "No check-ins yet". It doesn't count toward the
  goal's progress or health; a goal with only such metrics shows
  "Tracking".
- **Dashboard panes scroll on their own** on desktop: the filters and
  the charts each fill the window under the header and scroll within it.

- **System console.** Running the instance now has its own space at
  `/system`: status, settings, users and roles, all organizations and the
  logs, with their own sidebar and a "Back to GoalNexa" link. Admins
  open it from the user menu ("System console"); the app's sidebar no
  longer lists admin pages. Users and roles moved from
  `/platform-auth/users` and `/platform-auth/roles` to `/system/users`
  and `/system/roles` - update any bookmarks.
- **Health endpoint.** `GET /api/v1/health` answers once the backend
  reaches its database; every compose and stack healthcheck probes it.
- **Share the dashboard by link.** "Share" on the dashboard makes a
  public, read-only link to the goals shown (`/shared/<token>`): the
  same charts, live, no sign-in - without check-in notes or who checked
  in. Each link is listed there and can be revoked; a goal its creator
  can no longer see (left the org, made private) drops off it. Rate
  limited per IP (`GOALNEXA_SHARED_DASHBOARD_RATE`, default 120/min).
- **Ready for the ChatGPT app directory.** Every MCP tool states
  `openWorldHint` too (true for every write - what it changes is
  shared with an organization's members - `MCP_TOOL_ANNOTATIONS` corrects a
  resource tool's hints), and `MCP_OPENAI_APPS_CHALLENGE` serves OpenAI's
  domain-verification token at `/.well-known/openai-apps-challenge`
  (unset = 404). If you run your own nginx config, route that path to the
  backend like `/.well-known/oauth-*`.
- **Account lockout.** An account locks for 15 minutes after 10 wrong
  passwords in a row (System > Settings: "Lock an account after failed
  logins", "Lock it for"; 0 attempts = never). The owner gets an email;
  a password reset or an admin's Unlock on the user's page ends it
  sooner. Locks are in the audit log.
- **Password rules.** New passwords - signup, reset, change - must meet a
  minimum length (a setting, default 8) and may not be one of the 20,000
  most common ones (a setting, on by default). Existing passwords keep
  working.
- **Single sign-on (OpenID Connect).** "Sign in with ..." for a
  provider - Google, Authentik, Keycloak, Microsoft Entra ID, ... - set
  with `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`; more than
  one (a button each, with Google's and Microsoft's logos) with
  `OIDC_PROVIDERS`. Links to an
  existing account by verified email; new people get an account under
  the same signup policy as the signup form. "Allow email + password
  login" can be turned off to make it the only way in. See
  [`docs/sso.md`](docs/sso.md).
- **Use it from your AI assistant, without the website.** What a
  connected assistant needs to do the whole job by chat:
  - The MCP server now tells the assistant how to plan a goal, log a
    check-in and review progress, so a client with only the connection -
    no skills installed - answers with progress, days left and next
    steps, in the language you write in.
  - Replies end with a link that opens the dashboard on that goal
    (`/dashboard?goal=<id>`).
  - New tools: `goals_chart` (a goal's readings over time, to draw or
    summarize) and `reminder_settings_get` / `_update` / `_test` (set up
    reminders and the digest by chat).
  - The skills offer to set up reminders and to invite teammates.
  - Connecting an assistant with no account yet: sign up, confirm your
    email, and you're back on the "Allow" page instead of the dashboard.
  - Status shows who logged check-ins over 7 and 30 days: web, AI agent
    or ingest, with shares.
  - Someone who started by chat and has goals but no organization gets
    the dashboard, not the onboarding wizard.
- **Upgrade test.** CI upgrades an install of the oldest supported
  release, with data, to every commit (`scripts/upgrade_test.sh`).
  `docs/upgrading.md` documents versions and the upgrade steps.

### Changed

- **Each goal's chart has its own time range** on the dashboard (and on
  shared links), instead of every panel spanning the earliest to the
  latest date of all shown goals - a quarterly goal no longer sits in a
  sliver of a yearly one's timeline.
- **The dashboard leaves out archived goals.**

### Removed

- **Django admin.** `/admin/` is no longer served - everything it was
  used for is in the system console. **Action needed** if you run your
  own nginx config or healthchecks: drop the `/admin/` location and probe
  `/api/v1/health` instead of `/admin/login/`.

### Upgrade notes

- New migration: `platform_auth.0005_lockout_sso` (two columns on the
  user table, one new table). Nothing to do beyond the usual steps.
- New optional `.env` keys: `OIDC_*`, `AUTH_PASSWORD_LOGIN`,
  `AUTH_LOCKOUT_ATTEMPTS`, `AUTH_LOCKOUT_MINUTES`,
  `AUTH_PASSWORD_MIN_LENGTH`, `AUTH_PASSWORD_REJECT_COMMON`.
- Lockout is on by default after upgrading (10 attempts, 15 minutes).
- **Action needed if you administer users or roles through an AI
  client:** MCP now exposes goal tracking only (organizations, members,
  invitations, goals, metrics, check-ins, cycles, comments, activity).
  Set `MCP_RESOURCES=*` in `.env` to get every resource back.
- New optional `.env` key: `MCP_RESOURCES`.

## Before the changelog

Everything up to commit `6bdf9bc5` (2026-10-01): goals, metrics and
check-ins, the dashboard, schedules and reminders, ingest URLs, cycles,
digests, the activity feed and comments, organizations and roles, the MCP
server and agent skills, and system administration. That commit is the
oldest supported release to upgrade from until `v1.0.0` is tagged.
