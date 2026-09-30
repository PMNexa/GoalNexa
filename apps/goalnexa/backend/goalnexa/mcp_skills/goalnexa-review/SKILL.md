---
name: goalnexa-review
description: Review progress on GoalNexa goals (weekly review, stand-up, "how are my goals doing?", "what's behind?"). Reports progress, projection and health against target dates, flags at-risk goals and overdue metrics, and suggests next steps.
---

# Review GoalNexa goals

Review goals through the **{{server_name}}** MCP server (`{{mcp_url}}`).
Tools are named `<resource>_<action>` (e.g. `goals_list`), possibly with a
client prefix. If they're missing, point the user to {{tokens_url}} and stop.

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
  that's past its target.
- `projected_progress`: where the goal lands by its `target_date` if each metric
  keeps its check-in trend (null without a target date or a trend).
- `health`: `on_track` (projected ≥ 100%), `at_risk` (≥ 80%), `off_track` (less,
  or the target date passed), `achieved`, or `unknown` (no metrics, no target
  date, or fewer than two check-ins to trend from).

**Overdue metrics**: a metric with a schedule (`check_in_every`) has
`check_in_due_at`; it's overdue once that's passed -
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

Be brief, and don't restate the method unless asked.
