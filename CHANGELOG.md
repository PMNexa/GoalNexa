# Changelog

What changed in each release, newest first. How to upgrade:
[`docs/upgrading.md`](docs/upgrading.md). Versions are git tags
(`vMAJOR.MINOR.PATCH`); an entry marked **Action needed** asks something
of you beyond the usual upgrade steps.

## Unreleased

### Added

- **Goal templates: when check-ins happen, like goals.** A template goal
  has "Check-ins are for" with its moment; sub-goals inherit it from their
  parent and metrics from their goal (the default for new ones), or pick
  their own. Every team's copy follows. Existing template goals, and
  template metrics set to "Any time", become inherited - nothing changes
  until a template goal gets a setting; a metric's own period stays.
- **"Check-ins are for" picker**: one dropdown on goal, metric and
  template metric forms - pick the period, then its moment (weekday,
  month of the quarter, month, day, time) and whether it's due then, in
  the same menu. Generic forms can draw a group of fields with a
  registered widget (platform-core `registerFieldWidget`).
- **Ready for phone apps** (P-67..P-72, `docs/mobile-app.md`): native
  sessions (`"client": "native"` returns the refresh token in the body;
  refresh/logout take it there), single sign-on from an app (one-time
  code + PKCE, `POST auth/sso/token`, `PLATFORM_AUTH_APP_REDIRECTS`),
  `CheckIn.client_ref` so a retried check-in is never logged twice, the
  "phone app" check-in source (`X-GoalNexa-Client: mobile`),
  `GET /api/v1/today`, a chart payload with each metric's projection and
  the range to draw, and `min_app_version` in `auth/config` (System >
  Settings > Phone apps). The admin's session list shows app sessions.
  `GET today` names each goal's `org_id` and `team_id`.

- **Team board "Over time"**: a third mode - rows are teams, their goals
  and metrics, columns the last 14 days (or weeks, months... with Show
  by), each cell what was done in that period against its target
  (`board?show=&periods=N`). The pickers fold away (remembered); the board shows the
  organization picked in the header, with no picker of its own.
- **Team board charts**: Check in and Over time switch between Table and
  Chart (remembered). Check in's chart is a bar per team for each metric,
  as a % of its target (totals last); Over time's, a line per team across
  the periods, hover for every team's and total's numbers.
- **When check-ins happen**: "Check-ins are for" sits right under a goal's
  title and a metric's name, and a period gets its moment - a day's time; a
  week's weekday and time; a month's day and time; a quarter's month, day
  and time; a year's month, day and time. Check-ins are dated at that
  moment, and (Due at that moment, on by default for new goals and metrics)
  it's when the period's check-in is due and reminded. Sub-goals inherit
  their parent goal's setting, metrics their goal's, sub-metrics their
  parent metric's. "Check in every" adds Quarterly and Yearly.
- **Period picker**: the team board picks its periods with one control -
  Day, Week, Month, Quarter or Year, then a day, week, month... from a
  calendar or grid; in Over time a range (first and last period, up to
  60) instead of a fixed count. Month labels show the full year.
- **Check-in table: charts**: Table / Chart; per goal, its and its
  metrics' progress over the columns, a tracked metric in its unit.
- **Skills use the team tools**: check-in (`check_ins_bulk`, team metric
  ids from the board), review (a team review from `goal_templates_board`,
  closing a cycle), plan (goal templates for several teams, targets,
  reorder).
- **Board charts fit their data**: each Over time chart spans its own
  periods, from its metric's first check-in to its last.
- **MCP: team tools**: `check_ins_bulk`, `cycles_close`,
  `goal_templates_board` / `_targets` / `_apply` / `_leave` / `_totals`,
  `goals_reorder`, `metrics_reorder`; the server's instructions say when
  to use the team board.
- **Check-in table: team tags**: a team's goal shows its team after the
  title, a team total "Total" (as on the dashboard).
- **Over time cells**: hover for the details (period, value / target, %,
  how many check-ins and when); click a team's cell to type its number for
  that period - a reading is checked in as is, an amount as the difference.
  A period with no check-in shows "—", not 0 (`shown`/`history` cells
  carry `count` and `last_at`; `value` is null then, SUM metrics too).
- **Team board: pick who plays and what adds up**. In Targets, two tick
  columns next to the team names: "Own" adds a team (a department too)
  to the template or takes it out (a team with check-ins keeps them as
  its own goals); "Total" calculates a department's or the whole
  organization's total - a department's total is no longer automatic.
  A department with its own targets is one row: its own numbers, its
  total as a line under each cell. Both columns stay pinned.
  Check in shows only the teams that run the template, with a count of
  the others. The team column is only as wide as its longest name.
  Existing totals stay ticked.
- **Teams org chart**: Organizations > Teams opens as an org chart - the
  organization on top, each team with its lead and members, sub-teams
  below. Owners and admins create, rename, move and delete teams and
  add, promote and remove people right on the chart; "List" switches to
  the table.
- **One reading per period** (`docs/period-targets.md`). A metric can
  count only the last check-in of each day, week, month, quarter or year
  ("Which check-ins count"): a later check-in replaces the earlier one,
  and for amounts each check-in is the period's total so far ("10,500
  steps today"). Earlier check-ins are kept, marked replaced. The
  check-in form says what it replaces and fills it in, the feed says
  "replacing 8,000", the dashboard snaps such a metric to its period, and
  the assistant sends the period's total and says what it replaced.
  Goal templates and the template wizard carry it.
- **Targets per period** (`docs/period-targets.md`). A metric whose
  check-ins are amounts to add can have its target per day, week, month,
  quarter or year ("10 calls a day"), counting every day or weekdays
  only, in the organization's new **time zone** setting. Its progress is
  either the total against every period's target or how often the target
  is hit (with a streak); health follows the pace - where it should be by
  now. Goal templates and the template wizard carry it; team totals add
  the targets up or average the hit rates. The board and the goal tree
  show this period ("Today 6/10"); the dashboard draws bars per period
  and can show check-ins by day/week/month/quarter/year; a reminder goes
  out in the evening of a period's last day when it's still short. A
  running total with a target date shows the pace needed per day or week.
- **Team board**: "+ New" opens a template wizard (name, goals, metrics,
  teams, review), an empty template has "Set it up", and a team that
  doesn't use the template can be added from its row. Organization
  owners and admins can click a goal or metric column header to edit it
  in a drawer, or the "✕" after it to remove it from the template (a
  team's copy with check-ins is kept as the team's own); every team's
  copy follows.
- **Clearer forms**: goal, metric, template goal and template metric
  forms are grouped into sections (the basics, check-ins, target, team
  totals) with rarely used fields folded under "Advanced"; "Count days"
  and "Progress by" only show with a target per period. Resources declare
  this in their serializer (`Meta.form_layout`); a screen can override it
  (`formLayout`).
- **Team board scrolls with the page**: no inner vertical scroll; the
  header rows stay pinned under the top bar (full screen unchanged).
- **Team board period picker**: with "Show by" a period, "Checked in at"
  becomes that period's picker (a date for Day; "This week" / "Week of
  Oct 5" / ... for the others) - the board shows it, and check-ins go to it.
- **Check-ins for a period, per goal**: a goal has "Check-ins are for"
  too (any time / a day / week / month / quarter / year). Its metrics
  follow it ("Same as goal", the default for new metrics and for existing
  ones left at "any time"); a metric can still pick its own period.
  Changing the goal's setting moves its metrics' check-ins.
- **Check-ins for a period**: a metric's check-ins can be for a whole
  day, week, month, quarter or year ("Check-ins are for"). Every check-in
  - from the website, the team board, the assistant or a script - is
  dated to its period's first day, and changing the setting moves the
  existing ones. The check-in form asks "For: This week / Week of Oct 5
  / ..." instead of a date and time. With "Which check-ins count: last
  one each week", a correction replaces that week's number.
- **Team board full screen**: "⛶ Full screen" in the board's footer
  shows the grid and its save bar on the whole screen (Esc leaves).
- **Team board "Last update"**: each goal has a column with the time
  each team last checked in on it that day (the day of "Checked in at"),
  or when it last did; totals show how many of their teams updated.
- **Team board "Show by"**: next to "Checked in at", pick a day, week,
  month, quarter or year to see every cell in that period (around the
  picked time): the amount done in it or the last reading by its end,
  against the period's target, with team totals added up, averaged or
  the lowest by each metric's rule.
- **Teams, goal templates and team totals** (`docs/team-templates.md`).
  An organization's teams form a tree (Organizations > Teams; a
  department is a team with sub-teams), with leads and members. A **goal
  template** (Goal tracking > Goal templates, owners and admins only)
  holds one goal system - goals, sub-goals, metrics - that several teams
  run: added to a team, it gives the team its own copy, whose titles and
  metrics follow the template (every change reaches every team) while the
  targets and check-ins are the team's. Totals add the teams up for every
  department and the whole organization (sum, average or the team
  furthest behind, per metric), with an optional planned (top-down)
  target and the gap to what the teams committed. The **Team board** is
  one grid per template and cycle - teams down, goals and metrics across
  - to check in for several teams at once or set targets. On the
  dashboard, each team's copy is tagged with its team and a total with
  "Total". A goal can be
  visible to its team only (and the teams under it, the leads above it,
  the org's owners and admins); it still counts in the totals. Closing a
  cycle rolls a team's copy over with blank targets. Assistants check in
  on the speaker's own team's copy (`in_my_team` on metrics).
- **Lifecycle email** (`docs/lifecycle-email.md`). GoalNexa can email
  people at the right moments: onboarding from signup to the first
  check-in (welcome, first goal, first check-in, check in by chat, one
  week in), one feature tip a week for features they haven't used,
  milestones (a goal at 50% and 100%, 4 and 12 weeks of check-ins in a
  row), a win-back series after a week away that stops after 60 days,
  an invite-your-team nudge, and a summary for an organization's owner
  when its members stop checking in. At most 2 a week, none at night in
  the user's time zone, and a 10% holdout gets none, so System >
  Lifecycle email shows what each email changes (clicks, the action it
  asks for within 72 hours, lift over the holdout, unsubscribes), with a
  preview and "send a test to me" for every step. **Off when
  self-hosted** (`LIFECYCLE_ENABLED`, or System > Settings); it needs
  `GOALNEXA_PUBLIC_URL`. New accounts get the weekly digest by email
  while it's on.
- **Email preferences and one-click unsubscribe.** User menu > Email
  preferences, and a signed-out page from every email's footer, turn off
  "Reminders & digest", "Tips & getting started" or "Progress &
  milestones"; mail clients get `List-Unsubscribe` one-click headers.
  Account emails are always sent.
- **Bounces and complaints from Amazon SES.** With a configuration set
  and an SNS topic (`EMAIL_SES_CONFIGURATION_SET`, `EMAIL_SES_TOPIC_ARNS`,
  `docs/deployment.md`), hard bounces and spam complaints put the address
  on System > Suppressed addresses - nothing more is sent to it, account
  mail included - and System > Status counts them.
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
- **Unarchiving a goal, or moving one into an organization, counts
  against the organization's goal limit** (like creating one), so it can't
  take the organization over it.

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

### Fixed

- Goals and metrics are named by their title/name again (page titles,
  pickers, links) - the check-in moment fields had become the name.
- A record's details follow its form's order and hide the settings that
  don't apply (e.g. a weekday for monthly check-ins); long choices wrap;
  "Pace" reads as text, not `[object Object]`.
- "Check-ins are for" is read-only on a team's copy of a goal template
  (set on the template's metrics), instead of failing on save.
- **Folded sidebar**: a group's flyout no longer closes while the
  pointer moves from the icon onto it.
- Team board "Show by": a reading metric shows only a check-in made in
  that period ("—, no check-in"), no longer the last earlier reading.
- Forms show why a save was refused, under each field and spelled out,
  instead of "Request failed validation.".
- Forms: picking "Any time", "Every check-in counts" or "The whole goal"
  no longer fails with "This field may not be null", and a new record's
  dropdowns show what it will get (a new metric's "Same as goal").
- Closing a cycle kept a rolled-over metric's targets per period, one
  reading per period and check-ins for a period.

## Before the changelog

Everything up to commit `6bdf9bc5` (2026-10-01): goals, metrics and
check-ins, the dashboard, schedules and reminders, ingest URLs, cycles,
digests, the activity feed and comments, organizations and roles, the MCP
server and agent skills, and system administration. That commit is the
oldest supported release to upgrade from until `v1.0.0` is tagged.
