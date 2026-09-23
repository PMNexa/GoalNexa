---
name: goalnexa-review
description: Review progress on GoalNexa goals (weekly review, stand-up, "how are my goals doing?", "what's behind?"). Computes progress and pace against target dates, flags at-risk goals and stale metrics, and suggests next steps.
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

Leave out `archived` (and, unless asked, `completed`) goals. Add
`include: ["metrics"]` to get each goal's metrics in the same call, and use
`page_size: 100`.

## Numbers

- Metric progress = `(current_value - base_value) / (target_value - base_value)`.
  It works for metrics meant to go down too. Clamp to 0–100% for display, but
  mention a metric that's past its target.
- Goal progress = the mean of its ROOT metrics' progress (`parent` is null).
  Sub-metrics break a root metric down; they don't count toward the goal.
- **Pace** (for goals with a `target_date`): find the goal's start, which is the
  earliest check-in of any of its metrics (`check_ins_list`,
  `filter: {"metric": "<id>"}`, `sort: "checked_in_at"`, `page_size: 1`). Then
  expected = elapsed time ÷ (target_date − start). A goal is **at risk** when
  progress is more than 15 points below expected, or its target date has passed
  without reaching 100%.
- **Stale metric**: no check-in in the last 14 days (latest check-in:
  `sort: "-checked_in_at"`, `page_size: 1`).

Keep the tool calls lean. Fetch check-ins only for goals with a target date, and
only the one or two rows you need per metric.

## Output

1. One line: how many goals, and how many are on track or at risk.
2. A table: goal · due · progress · pace (expected %) · status (on track /
   at risk / done / no date). Order it at risk first, then by due date.
3. For at-risk goals, the weakest metric with `current / target unit`.
4. Stale metrics, as a short list.
5. At most three concrete suggestions (e.g. "log this week's reading for
   Subscribers", "the hiring goal needs 2 more hires in 9 weeks"). Suggestions
   only: change nothing unless the user asks.

Be brief, and don't restate the method unless asked.
