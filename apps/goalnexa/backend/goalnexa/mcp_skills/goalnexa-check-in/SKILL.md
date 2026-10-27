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
- A metric with **one reading per period** (`one_per`: day, week, month,
  quarter or year) counts only the LAST check-in of each period, in the
  organization's time zone; earlier ones are kept with `replaced: true`. On a
  `"sum"` metric each check-in is then **the period's total so far** ("10,500
  steps today"), not an amount to add.
- A metric with `snap_period` (day, week, month, quarter or year - its own
  `snap_to`, or inherited when `snap_to` is `"goal"`) takes check-ins
  **for a whole period**: the server sets every check-in's `checked_in_at` to
  that period's moment (the first day, 00:00 unless `snap_weekday`/`snap_day`/
  `snap_time`/... say otherwise; the organization's time zone). To log one
  for an earlier period ("last month's revenue"), send any time inside it;
  confirm with the period ("for October"), not a time.
- A metric can go down on purpose (response time 12h → 2h: target below base).
- Progress = `(current - base) / (target - base)`, and a goal's progress is the
  mean of its root metrics' (`parent` null) - sub-metrics don't count toward it.

- A metric can have a **target per period** (`target_per`: day, week, month,
  quarter or year, counting every day or weekdays only - `count_days`): then
  `target_value` is the quota per period, counted in the organization's time
  zone. Its progress is either the total against every period's quota
  (`progress_by: "total"`, measured against `cumulative_target`) or the share
  of periods hit (`"hit_rate"`, with a `streak`). `period_value` is what's
  checked in this period, and `pace` sums it up: `{"period_label": "today",
  "done": 6, "quota": 10, "left": 4}`. For a plain running total with a
  target date, `pace.per_day` / `per_week` is what's needed to land on target.

## Steps

1. **Find the metric.** Use `metrics_list` with
   `filter: {"name.icontains": "<keyword>"}` and `include: ["goal"]` so you see
   which goal each match belongs to. Try a second keyword if the first finds
   nothing (e.g. "km" → "distance", "subs" → "subscribers").
   - Leave out team totals (`is_total: true`): they add the teams up and refuse
     check-ins.
   - Several teams running the same goal template each have their own copy of
     the metric (same name, different `goal.team_id`). Take the one with
     `in_my_team: true` - the user's own team's. More than one (they're in
     several teams): ask which team.
   - A team's lead may give members their own share of the team's goals: a
     copy marked `for_me: true` is the user's own - take it before the
     team's (`in_my_team`) when the number is theirs ("I closed 3 deals");
     when it's clearly the team's ("the team is at 40"), take the team's
     (`for_me: false`, `goal.assignee_id` empty).
   - One clear match: use it.
   - Several: ask which one, listing `goal → metric (current / target unit)`.
   - None: say so and offer to create the metric (`metrics_create` with `goal`,
     `name`, `unit`, `base_value`, `target_value`), after confirming the numbers.
2. **Work out the value to record** - it depends on the metric's `aggregation`.
   - `"sum"` metric with `one_per`: send the period's total so far ("10,500
     steps today" → `10500`), never the difference - it replaces the period's
     earlier check-in. Only if the user gives an amount ("2,500 more steps"),
     add it to the latest check-in if it's in this period (`check_ins_list`,
     `filter: {"metric": "<id>"}`, `sort: "-checked_in_at"`, `page_size: 1`)
     and say so, e.g. "8,000 + 2,500 = 10,500".
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
   at or past its target (a tracked-only metric - `target_value` =
   `base_value` - has no %: give the change instead). The goal's own `progress` averages all its root
   metrics, so it differs from this one's; mention its `health` if it's
   `at_risk` or `off_track`. A metric with a target per period: lead with
   this period from `pace` ("6/10 today - 4 to go"), then its `hit_rate` and
   `streak` or its total. A `one_per` metric: the response's `replaces` is the
   check-in it replaced - say "8,000 → 10,500 today (replaces the earlier
   one)"; `replaced: true` means a later check-in in that period still counts,
   so this one doesn't - tell the user. For several updates in one message,
   log each one and confirm them as a short list.
6. **Say what's next**, briefly: days left to the goal's `target_date`, and one
   or two actions sized to what's left ("18 km to go in 9 days: about 2 km a
   day" - `pace.per_day` has the number) - not general advice. End with the goal's link,
   `{{app_url}}/dashboard?goal=<goal id>`, where its chart is. If the user asks
   for the chart itself, `goals_chart` returns the readings over time: draw it
   if you can.

## Several numbers at once

For several updates in one message ("North closed 12k, South 9k", "today:
6 demos, 2 deals"), work out each value as above, then log them in ONE
`check_ins_bulk` call (`items`: `metric`, `value`, optional `note` and
`checked_in_at`) - all or nothing, so a bad item saves none: fix it and
resend. For team numbers, the team board has every team's metric ids:
`goal_templates_list` (`q` = the template's name) → `cycles_list`
(`filter: {"status": "active"}`) → `goal_templates_board` with `id` and
`cycle`; `instances["<team id>"].metrics["<template metric id>"].id` is
that team's metric (`teams` names the team ids, `metrics` the template
metric ids), and `can_check_in` says whether the user may. Confirm as a
short list, one line per team and metric.

Don't delete or edit earlier check-ins unless the user asks. A correction is a
new check-in, or `check_ins_update` on the one they point to.
