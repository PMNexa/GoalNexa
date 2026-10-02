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

Answer in the language the user writes in; keep titles, names and notes in
their own words.

## How GoalNexa models progress

- A **goal** has one or more **metrics**. A metric has `base_value` (where it
  started), `target_value`, `unit` and `current_value`.
- A metric's `aggregation` says what a **check-in**'s `value` is:
  - `"latest"` (most metrics): a *reading*, the metric's value at a moment
    (`checked_in_at`). `current_value` is the latest check-in's value.
  - `"sum"`: an *amount done* ("ran 12 km", "3 more calls"). `current_value` is
    `base_value` plus every check-in.
  The server recomputes `current_value` either way - never add it up yourself.
- A metric can go down on purpose (response time 12h → 2h: target below base).
- Progress = `(current - base) / (target - base)`, and a goal's progress is the
  mean of its root metrics' (`parent` null) - sub-metrics don't count toward it.

## Steps

1. **Find the metric.** Use `metrics_list` with
   `filter: {"name.icontains": "<keyword>"}` and `include: ["goal"]` so you see
   which goal each match belongs to. Try a second keyword if the first finds
   nothing (e.g. "km" → "distance", "subs" → "subscribers").
   - One clear match: use it.
   - Several: ask which one, listing `goal → metric (current / target unit)`.
   - None: say so and offer to create the metric (`metrics_create` with `goal`,
     `name`, `unit`, `base_value`, `target_value`), after confirming the numbers.
2. **Work out the value to record** - it depends on the metric's `aggregation`.
   - `"sum"` metric: send the amount done ("ran 12 km" → `12`). If the user gives
     a new total instead ("I'm at 60 km"), send the difference from
     `current_value` and say so, e.g. "60 − 48 = 12".
   - `"latest"` metric, a total or reading ("we're at 420", "rating is 4.3"):
     record it as is.
   - `"latest"` metric, an increment ("12 more signups"): add it to
     `current_value` and say so, e.g. "353 + 12 = 365".
   - If it could be either, ask.
   - Units: convert when the metric's `unit` clearly differs (e.g. minutes →
     hours), and show the conversion.
3. **Work out when.** Leave `checked_in_at` out for "now". For "yesterday",
   "last Friday", "on the 3rd", send an ISO 8601 datetime in the user's time zone.
   A backdated check-in only becomes `current_value` if it's the latest one.
4. **Create it** with `check_ins_create`: `metric` (id), `value`, and optional
   `note` (the user's own words, briefly) and `checked_in_at`.
5. **Confirm** in one line: metric, old → new value (the `current_value` the
   server returns on `metrics_get`), the metric's progress %, and whether it's now
   at or past its target. The goal's own `progress` averages all its root
   metrics, so it differs from this one's; mention its `health` if it's
   `at_risk` or `off_track`. For several updates in one message,
   log each one and confirm them as a short list.
6. **Say what's next**, briefly: days left to the goal's `target_date`, and one
   or two actions sized to what's left ("18 km to go in 9 days: about 2 km a
   day") - not general advice. End with the goal's link,
   `{{app_url}}/dashboard?goal=<goal id>`, where its chart is. If the user asks
   for the chart itself, `goals_chart` returns the readings over time: draw it
   if you can.

Don't delete or edit earlier check-ins unless the user asks. A correction is a
new check-in, or `check_ins_update` on the one they point to.
