---
name: goalnexa-review
description: Review progress on GoalNexa goals (weekly review, stand-up, "how are my goals doing?", "what's behind?"). Reports progress, projection and health against target dates, flags at-risk goals and overdue metrics, and suggests next steps.
---

# Review GoalNexa goals

Review goals through the **{{server_name}}** MCP server (`{{mcp_url}}`).
Tools are named `<resource>_<action>` (e.g. `goals_list`), possibly with a
client prefix. If they're missing, point the user to {{tokens_url}} and stop.

Answer in the language the user writes in; keep titles, names and notes in
their own words.

## Scope

- **An organization's goals**: find it with `orgs_list` (`q` = name), then
  `goals_list` with `filter: {"org_id": "<org id>"}`.
- **Personal goals**: `goals_list` with `filter: {"org_id.isnull": true}`.
- **Everything**: no filter.
- **A cycle** (a quarter or other period): `cycles_list` (`q` = its name, or
  `filter: {"status": "active"}` for the current one), then add
  `"cycle": "<cycle id>"` to the goals filter. For "this quarter", prefer the
  active cycle when the organization uses cycles.

Leave out `archived` (and, unless asked, `completed`) goals. Add
`include: ["metrics"]` to get each goal's metrics in the same call, and use
`page_size: 100`.

## Numbers

The server keeps these up to date on every goal - read them, don't recompute:

- `progress`: the mean progress of the goal's ROOT metrics (`parent` null), in %.
  A metric's own progress is
  `(current_value - base_value) / (target_value - base_value)` (it works for
  metrics meant to go down too). Clamp to 0–100% for display, but mention one
  that's past its target. A metric with `target_value` = `base_value` is
  tracked only: no %, left out of `progress` - report its value and trend.
- `projected_progress`: where the goal lands by its `target_date` if each metric
  keeps its check-in trend (null without a target date or a trend).
- `health`: `on_track` (projected ≥ 100%), `at_risk` (≥ 80%), `off_track` (less,
  or the target date passed), `achieved`, or `unknown` (no metrics, no target
  date, or fewer than two check-ins to trend from).
- A metric with `target_per` has a quota per day/week/month/quarter/year:
  report this period (`pace`: done / quota, what's left), then the
  `hit_rate` and `streak` (`progress_by: "hit_rate"`) or the total against
  `expected_value` - where it should be by now. For a running total with a
  target date, `pace.per_day` is the pace needed from here.
- A metric with `one_per` counts only the last check-in of each period - the
  server's numbers already do; check-ins with `replaced: true` don't count.
- Teams: when several teams of an organization run the same goal template, each
  team has its own copy of the goal (`team_id`), and a goal with
  `is_rollup: true` is a **total** - a department's (its `team_id`) or the whole
  organization's (`team_id` null) - calculated from the teams' copies. Review a
  team's own copy, and use the totals for the big picture; a total's metric may
  have a `planned_target`, leadership's number, that its progress is measured
  against.

**A team review** (several teams running one goal template - "how are the
teams doing?", "who hasn't checked in?"): one call has it all.
`goal_templates_list` (`q` = its name) and the cycle (`cycles_list`), then
`goal_templates_board` with `id` and `cycle`: `teams` (id, name, parent),
`metrics` (the template's, by id), `instances` per team id (each metric's
`base_value`, `target_value`, `current_value`, `progress`, `pace`, and
`last_update` per goal - `on_day` null means no check-in today) and `totals`
per department and `"org"` (with `planned_target` and `teams_target`, the
teams' own targets added up). Add `show` (day/week/month/...) for this
period's numbers per cell (`shown`: `value`, `quota`), and `periods` (up to
60) for a trend (`history`, oldest first; `value: null` = no check-in that
period). Present it as a table: team · each metric's current / target ·
progress, totals last; name the teams that haven't checked in.

**Overdue metrics**: a metric with a schedule (`check_in_every`, or a
period's moment with `snap_due`) has `check_in_due_at`; it's overdue once that's passed -
`metrics_list` with `filter: {"check_in_due_at.lte": "<now, ISO 8601>"}` and
`include: ["goal"]`. A metric with no schedule is stale when
`last_checked_in_at` is more than 14 days ago (or null while the goal is in
progress).

**What changed** (for "since last week" or a stand-up): `activities_list` with
`filter: {"goal": "<id>", "created_at.gte": "<ISO date>"}` - check-ins (with
`data.source`: web, agent or ingest), metric and goal changes, health changes
and comments.

Keep the tool calls lean: one `goals_list` with `include: ["metrics"]` has
everything above.

## Output

1. One line: how many goals, and how many are on track or at risk.
2. A table: goal · due · progress · projected · health. Order it off track and
   at risk first, then by due date.
3. For at-risk goals, the weakest metric with `current / target unit`.
4. Overdue and stale metrics, as a short list.
5. At most three concrete suggestions (e.g. "log this week's reading for
   Subscribers", "the hiring goal needs 2 more hires in 9 weeks"). Suggestions
   only: change nothing unless the user asks.
6. The link to look at it: {{app_url}}/dashboard, or
   `{{app_url}}/dashboard?goal=<goal id>` for one goal. For a trend or a chart
   of one goal, `goals_chart` returns its readings over time: draw it if you
   can.

## Closing a cycle

At a cycle's end ("wrap up Q4"), review its goals as above, then propose
per goal: `done`, `rollover` (into the next cycle - a copy with its
metrics; a reading starts from its current value) or `drop`, a `score`
0-1 (default = its progress) and a one-line `reflection`. Show the list,
and only after a yes call `cycles_close` with `id`, `decisions`
(`goal`, `action`, `score`, `reflection`), `next_cycle` when anything rolls
over (`cycles_list`, a `planning` or `active` one of the same
organization), and `retro` for the cycle's notes. It can't be undone: the
cycle becomes read-only. Report the scores it returns.

If an organization's goal has had no check-in from anyone but the user, you may
suggest once that they invite the teammate who owns the number
(`org_invitations_create`).

Be brief, and don't restate the method unless asked.
