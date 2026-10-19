---
name: goalnexa-plan
description: Turn an intention into a GoalNexa goal with measurable metrics ("I want to run a half marathon in November", "help me set our Q1 OKRs"). Drafts the goal, 1-4 metrics with base and target values, and creates them after the user confirms.
---

# Plan a GoalNexa goal

Create goals and metrics through the **{{server_name}}** MCP server
(`{{mcp_url}}`). Tools are named `<resource>_<action>` (e.g. `goals_create`),
possibly with a client prefix. If they're missing, point the user to
{{tokens_url}} and stop. Call `goals_schema` / `metrics_schema` once if you're
unsure of a field.

Answer in the language the user writes in; keep titles, names and notes in
their own words.

## 1. Draft

From what the user said, propose:

- **Goal**: a short outcome-style `title` ("Run a half marathon", not "Running"),
  an optional one-sentence `description`, a `target_date` (ask if there's no
  hint), and `status: "in_progress"` (or `"not_started"` if it starts later).
- **Owner**: personal by default. For a team or company goal, find the
  organization with `orgs_list` and set `org_id`. Ask if it's unclear.
- **Cycle**: if the organization (or the user, for a personal goal) runs
  cycles - `cycles_list` with `filter: {"org_id": "<id>", "status": "active"}`
  (or `"org_id.isnull": true`) - put the goal in the matching one (`cycle`) and
  default `target_date` to the cycle's `ends_on`. "Next quarter" can be a
  `planning` cycle; don't create cycles unless asked.
- **1–4 metrics**, each measurable with one number that someone can check in:
  `name`, `unit` (short: `km`, `%`, `users`, `hours`, or empty for a count),
  `base_value` (where it stands today; ask if unknown), `target_value`, and an
  optional one-sentence `description` (how it's measured, e.g. "Sum of paid
  invoices in the calendar month").
  - Prefer outcomes over activity ("Weekly distance 10 → 40 km" beats
    "Go running").
  - A metric that should go down gets a target below its base ("Median response
    time 12 → 2 hours").
  - Avoid yes/no metrics. If you need one, use 0 → 1.
  - A metric built up from amounts done ("run 100 km", "make 50 calls") gets
    `aggregation: "sum"`: each check-in is then the amount done, not the new
    total. Readings (weight, revenue to date, a score) keep the default,
    `"latest"`.
  - A number reported as "so far today" (steps, a daily count from a device)
    gets `one_per: "day"` (or week/month/...): only the last check-in of each
    period counts, so a later report replaces the earlier one. It can't be
    longer than a `target_per`. Not for amounts logged as they happen ("3 more
    calls").
  - A number reported per period ("weekly sales", "monthly revenue") can get
    `snap_to: "week"` (or day/month/...): each check-in is then for a whole
    period. Often with the same `one_per`, so a correction replaces that
    period's number. When every metric of the goal is reported that way,
    set `snap_to` on the GOAL instead: its metrics inherit it (`snap_to:
    "goal"`, the default), so do its sub-goals (`snap_to: "parent"`, the
    default) and a sub-metric inherits its parent metric's; a metric can
    still pick its own (`""` = any time).
  - With a period, ask WHEN in it the number is reported and set the
    moment: `snap_weekday` (1 = Monday ... 7), `snap_quarter_month` (1-3),
    `snap_month` (1-12), `snap_day` (1-31, past the month's end = its last
    day), `snap_time` (`"HH:MM"`, 30-minute steps) - e.g. weekly sales on
    Friday 17:00 (`snap_weekday: 5, snap_time: "17:00"`). Check-ins are dated
    at that moment, and with `snap_due` (on by default) it's when the
    period's check-in is due and reminded.
  - Without a period, suggest a schedule from the last check-in,
    `check_in_every`: `"daily"`, `"weekly"`, `"monthly"`, `"quarterly"` or
    `"yearly"` (default none). An overdue metric is flagged on the dashboard and
    reminded, if the user has reminders set up (step 4).

Before creating anything, check for duplicates: `goals_list` with
`filter: {"title.icontains": "<keyword>"}`. If there's a close match, ask
whether to add metrics to it instead.

### The same goals for several teams

When several teams should run the same goals ("each sales team gets a
revenue and a deals target"), use a **goal template** instead of separate
goals - organization owners and admins only:

1. Draft the template's goals and metrics as above, plus each metric's
   `default_target` and `rollup` (how totals combine the teams: `sum`,
   `avg`, `min` or `none`; see `template_metrics_schema`).
2. After a yes: `goal_templates_create` (`title`, `org_id`), then
   `template_goals_create` (`template`, `title`, `parent` for a sub-goal)
   and `template_metrics_create` (`template_goal`, ...).
3. Teams: `teams_list` with `filter: {"org": "<id>"}`; create missing
   ones only if asked (`teams_create`). Then `goal_templates_apply` with
   the template `id`, `teams` and the `cycle` - each team gets its own copy
   with the default targets.
4. Different targets per team: `goal_templates_targets` with `items`
   (`metric` = the team's metric id from `goal_templates_board`'s
   `instances`, `target_value`, optionally `base_value`). A department's or
   the organization's planned number goes on its total's metric as
   `planned_target`. `goal_templates_totals` picks which totals exist
   (`"org"` and/or teams with sub-teams).
5. Link to `{{app_url}}/board`, where every team's numbers sit side by side.

To take a team off, `goal_templates_leave` (a copy with check-ins is kept
as the team's own goals, an empty one deleted) - confirm first.

## 2. Confirm

Show the draft as a compact list and ask to confirm or adjust. Don't create
anything before the user says yes.

## 3. Create

1. `goals_create` with the goal's fields. Keep the returned `id`.
2. `metrics_create` for each metric, with `goal` = that id. `current_value`
   starts at `base_value`, so there's no need to send it.
3. For a sub-goal, set `parent` to the parent goal's id.
4. To put goals or metrics in a particular order (as they show on the
   dashboard and check-in table), `goals_reorder` / `metrics_reorder` with
   the sibling `ids` in order.

## 4. Wrap up

Confirm what was created (goal, due date, metrics as `base → target unit`) and
say where to see it: `{{app_url}}/dashboard?goal=<goal id>`. Offer to log a first
check-in if the user already has a current number that differs from the base.

Then, once each and only if it applies:

- **Reminders.** If a metric got a schedule, call `reminder_settings_get`. If
  `urls` is empty and `email` is off, nothing will remind the user: ask where
  reminders should go - email (when `email_available`), or a service from
  `allowed_schemes` (null = any Apprise service), e.g. Telegram
  `tgram://<bot token>/<chat id>` or `ntfy://<topic>` - and save it with
  `reminder_settings_update` (`urls` replaces the whole list, so send the
  existing lines too). `reminder_settings_test` sends a test message. Without
  those tools, point to {{app_url}}/reminders.
- **Teammates.** For an organization goal, offer to invite the people who
  should see or update it: `org_invitations_create` (see
  `org_invitations_schema`). The reply's `token` makes the link,
  `{{app_url}}/platform-org/invitations/<token>`: give it to the user to pass
  on, in case no email went out.
