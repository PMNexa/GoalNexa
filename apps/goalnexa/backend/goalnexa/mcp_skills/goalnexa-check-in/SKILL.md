---
name: goalnexa-check-in
description: Log progress in GoalNexa from a plain-language update ("ran 12 km today", "we're at 420 beta testers", "open rate hit 44% last Friday"). Use when the user reports a number that belongs to one of their goals' metrics.
---

# Log a GoalNexa check-in

Record progress on a metric through the **{{server_name}}** MCP server
(`{{mcp_url}}`). Tools are named `<resource>_<action>`, e.g. `metrics_list` or
`check_ins_create`, possibly with a client prefix like `mcp__{{server_name}}__`.
If they're missing, the MCP server isn't connected: point the user to
{{tokens_url}} and stop.

## How GoalNexa models progress

- A **goal** has one or more **metrics**. A metric has `base_value` (where it
  started), `target_value`, `unit` and `current_value`.
- A **check-in** is a *reading*: the metric's value at a moment
  (`checked_in_at`). It isn't a delta. `current_value` is always the value of the
  latest check-in by `checked_in_at`, and the server recomputes it.
- A metric can go down on purpose (response time 12h → 2h: target below base).
- Progress = `(current - base) / (target - base)`, and a goal's progress is the
  mean of its metrics'.

## Steps

1. **Find the metric.** Use `metrics_list` with
   `filter: {"name.icontains": "<keyword>"}` and `include: ["goal"]` so you see
   which goal each match belongs to. Try a second keyword if the first finds
   nothing (e.g. "km" → "distance", "subs" → "subscribers").
   - One clear match: use it.
   - Several: ask which one, listing `goal → metric (current / target unit)`.
   - None: say so and offer to create the metric (`metrics_create` with `goal`,
     `name`, `unit`, `base_value`, `target_value`), after confirming the numbers.
2. **Work out the value to record.**
   - A total or reading ("we're at 420", "rating is 4.3"): record it as is.
   - An increment ("12 more signups", "ran another 8 km this week" on a weekly
     total): add it to `current_value` and say so, e.g. "353 + 12 = 365".
   - If it could be either, ask.
   - Units: convert when the metric's `unit` clearly differs (e.g. minutes →
     hours), and show the conversion.
3. **Work out when.** Leave `checked_in_at` out for "now". For "yesterday",
   "last Friday", "on the 3rd", send an ISO 8601 datetime in the user's time zone.
   A backdated check-in only becomes `current_value` if it's the latest one.
4. **Create it** with `check_ins_create`: `metric` (id), `value`, and optional
   `note` (the user's own words, briefly) and `checked_in_at`.
5. **Confirm** in one line: metric, old → new value, progress %, and whether the
   metric is now at or past its target. For several updates in one message,
   log each one and confirm them as a short list.

Don't delete or edit earlier check-ins unless the user asks. A correction is a
new check-in, or `check_ins_update` on the one they point to.
