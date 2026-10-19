# Period targets: quotas, pace and hit rate

Design for metrics whose target is **per period** - "10 calls a day",
"3 workouts a week", "2 releases a month" - while the goal can still care
about the total ("900 calls this quarter") or about how many periods were
hit ("every day"). Roadmap: P-54..P-59 (`docs/roadmap.md`). Status:
built (2026-10-12); "As built" near the end. "One reading per period"
(P-60..P-62) at the end: built (2026-10-12).

## The cases

| Case | Example | Today |
|---|---|---|
| A. Check in often, goal is the total | "Sell 1,000 units this quarter", logged daily | Works: a `sum` metric, `check_in_every` daily, target 1,000. Missing: pace and per-day views |
| B. Quota per period, the total counts | "10 calls a day", and 900 this quarter | Not possible: a target is for the whole goal |
| C. Quota per period, every period counts | "The daily challenge, every day", "3 workouts a week" | Not possible: no hit rate or streak |

Both B and C are needed, so the choice is per metric.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Periods | **day, week, month, quarter, year**, or the whole goal (today's behaviour, the default) | Asked for: not only daily |
| Which metrics | A quota: `sum` metrics only ("an amount to add") | A reading (`latest`) has no per-period total to hold a quota against |
| Readings per period | **Display only, snapped**: a reading metric's value in a period = its last reading in that period (like the check-in table's snap to hour/day/week/month) | So "this week: 82 kg" and bars per period work for readings too, without a quota |
| Which days count | Per metric: **every day** or **weekdays only** (Mon-Fri) | Business quotas skip weekends, habits don't |
| Where a day starts | **The organization's time zone** (personal goals: the owner's) | One team needs one "today"; asked for |
| What the goal's % means | Per metric: **cumulative** (default, case B) or **hit rate** (case C) | Both asked for |
| Health | From **pace** (actual vs expected so far), not the regression | A quota defines the expected line exactly |
| Quota changes mid-way | The new quota applies to the whole range (recomputed) | Simple first; a quota history only if people need it |
| Partial periods | Prorated by counted days (a week starting Wednesday expects 3/5 of a weekday quota) | Keeps "expected so far" honest at the edges |

## Model

On `Metric` (and `TemplateMetric`, so templates carry it):

- `target_per`: `""` (the whole goal) | `day` | `week` | `month` | `quarter` | `year`.
- `count_days`: `all` | `weekdays` (only matters for `day`/`week`).
- `progress_by`: `total` | `hit_rate` (only with a `target_per`).

`target_value` then means **the quota per period** (and `base_value` stays
the start of the running total, normally 0). A metric's range is its goal's
cycle (or creation) -> target date.

On platform-org `Organization`: `timezone` (IANA name), defaulting to the
creator's browser zone; personal goals use the owner's `ReminderSettings.timezone`.

## Derived numbers (server `progress.py`, client `lib/progress.ts`)

For a period metric, from its check-ins bucketed by period in the org's
time zone:

- **This period's value** = the sum of this period's check-ins; % of the quota.
- **Cumulative target** = quota x counted periods in the range (prorated).
- **Expected so far** = quota x counted periods elapsed (prorated today).
- **Total %** = (value - base) / (cumulative target) - the existing formula
  with a derived target, so goal progress, totals and charts keep working.
- **Hit rate** = periods at or over quota / periods elapsed (the current
  period counts once it's over or already hit). **Streak** = consecutive
  periods hit, up to the current one.
- **Pace health** (replaces the projection for these metrics): hit rate
  or total vs expected so far - >= 100% on track, >= 80% at risk, else off
  track; achieved when the cumulative target is reached (total) or never
  for hit rate before the end.
- **Needed per period** (case A as well): (target - current) / periods
  left - shown, not stored.
- **A reading per period** (display only, any `latest` metric): the last
  reading in each period - "this week: 82", and the dashboard's bars per
  period - picked with a snap (day / week / month / quarter / year) on the
  screen, not stored on the metric. A period with no reading shows none
  (no carrying forward).

Stored on the metric for agents, filters and the board: `period_value`,
`hit_rate`, `streak` (refreshed with the rest in `refresh_metric_and_goal`,
and by `goalnexa_jobs` when a period rolls over).

## Teams and totals (`goalnexa.rollups`)

- A team's quota is its own target, like today.
- `sum` totals: quotas add up (the department's quota per day), this
  period's values add up, cumulative works unchanged.
- Hit-rate metrics: the total is the teams' average hit rate (`avg`) or the
  lowest (`min`); `sum` isn't offered for them.

## Screens

- **Team board**: a period metric's cell shows **this period** large
  ("Today 6/10", "This week 2/3") with the total ("Q4 420/900") or hit rate
  and streak ("73% of days · 5 in a row") underneath. Check in mode enters
  an amount for the day picked in "Checked in at". Targets mode edits the
  quota.
- **Dashboard**: bars per period against the quota line, plus the running
  total; the tree row shows this period's value. A reading metric can be
  shown snapped to a period too (its last reading per period).
- **Metric form / template wizard**: "Target is per: the whole goal / day
  / week / month / quarter / year", then "Counts: every day / weekdays",
  then "Progress is: the total / how often the target is hit".
- **Reminders**: besides "due", an end-of-period nudge when the current
  period is still under quota ("4/10 today").
- **Assistant**: the check-in reply gives this period's value and what's
  left ("6/10 today - 4 to go"), the review skill reports hit rate and
  streaks.

## Also in this batch

- **Add a team from the board's Check in mode**: an "Add" button on a
  team row that doesn't use the template (owners and admins), instead of
  having to switch to Targets.

## As built

- **Org time zone**: blank means the goal owner's zone (their reminder
  settings, saved from the browser), else UTC. The onboarding wizard sends
  the browser's zone when it creates an org; the generic org form shows a
  "Time zone" field (validated).
- **Recomputing**: `refresh_metric` stores the period numbers on every
  check-in/metric write; `goalnexa_jobs` refreshes every live period
  metric (and its goal and totals, batched) on each run, since expected
  and hit rate move with the clock.
- **Hit rate**: a metric at 100% hit rate keeps its goal "on track", not
  "achieved", until the target date passes.
- **Totals**: `rollups.combine_period` - sums (or means) of the teams'
  quotas, this period's amounts, total targets and expected values; a hit
  rate is the teams' average or lowest, the streak the shortest; a planned
  target scales the total target. A "lowest team" total over a
  total-per-period metric is a plain % (no period).
- **Pace** (`pace` on metrics): this period's done / quota / left, or for
  a whole-goal running total the amount needed per day (and per week from
  14 days out). Totals get it too.
- **Dashboard**: metrics with a target per period get bars per period
  against the target line (hit-rate metrics only as bars, not lines);
  "Show check-ins by" snaps every line to its last reading per period and
  adds bars for amount-to-add metrics. The client counts periods in the
  browser's zone and doesn't prorate partial periods - the stored numbers
  (and the board) are the server's.
- **Reminders**: one nudge per period, from 18:00 local on the period's
  last counted day, joined with the due check-ins in one message.

## One reading per period (P-60..P-62)

Some metrics are reported as "the number so far today": steps 8,000 at
noon, 10,500 in the evening - the second replaces the first, it isn't
added. A per-metric setting, **"One reading per: - / day / week / month /
quarter / year"** (`Metric.one_per`, blank = every check-in counts).

**Every check-in is kept; only the last one in each period counts** (by
`checked_in_at`, in the goal's zone; two at the same time: the one saved
later). Replacing the row at write time was rejected: in a team copy one
member would overwrite another's number, notes/author/feed would be lost,
a backdated check-in would replace the wrong day, and switching the
setting off couldn't bring the rows back.

| | "Each check-in is the new value" | "Each check-in is an amount" |
|---|---|---|
| Meaning | The value is already the latest check-in - unchanged; series and charts get one point per period | Each check-in is **the period's total so far** |
| Math | - | `refresh_metric`'s running total and `periods.compute` (period value, hit rate, streak) add up the last check-in of each period |
| Check-in form | - | With one already in this period: "Replaces today's 8,000 (09:12)", prefilled |
| Lists, feed, tooltips | Earlier ones in a period greyed as "replaced" | same |
| Dashboard | "Show check-ins by" defaults to the metric's period; coarser ones can still be picked | same |
| Assistant | - | Sends the period's total, not the difference; replies "8,000 -> 10,500 today (replaces the earlier one)" |

- **Templates** carry the setting, locked in team copies (like
  `target_per`). Team totals read each team's counted values, unchanged.
- **Changing the setting** recomputes the metric's history, like a quota
  change.
- **Not the default** for a metric with a target per period ("10 calls a
  day"): there a check-in is usually an amount done.
- The period may differ from `target_per` (one reading per day, quota per
  week): the week's value is the sum of each day's last reading.
  It can't be longer than `target_per` (one reading per month with a
  daily quota makes no sense) - refused on save.

### As built (P-60..P-62)

- `Metric.one_per` / `TemplateMetric.one_per` (locked in team copies; a
  total's is always blank - it has one reading a day already).
  `CheckIn.replaced` is stored, set by `refresh_metric` from
  `periods.counted`, so lists, filters and assistants see it without
  recomputing.
- A single check-in's response (create, retrieve, update - not lists)
  carries `replaces`: the check-in it replaced (`periods.replaced_by`), or
  null. The feed's check-in entry gets `replaces` (the old value) or
  `replaced: true`.
- Changing `one_per` (on a metric, or pushed from a template) recomputes
  the value and every `replaced` flag.
- The dashboard snaps a `one_per` metric to at least its period
  (`lib/periods.ts` `metricSnap`), so replaced check-ins aren't drawn;
  the client's running total replays "period total so far" in the
  browser's zone (`lib/progress.ts` `replayer`), and bars skip replaced
  check-ins (the server's flag).
- The check-in form looks up the period's latest check-in for the time
  picked, fills its value in, says what it replaces (and the new total,
  for now), or warns that a later one keeps counting.
- The team board's cell says "total today"; it previews the new total
  only when the reading period equals the quota period (then the
  period's value is the one being replaced).

## Check-ins for a period (P-63)

`Metric.snap_to` / `TemplateMetric.snap_to` ("Check-ins are for": any
time / a day / week / month / quarter / year). A check-in is then for a
whole period, not a moment: `CheckIn.save` sets `checked_in_at` to the
period's first day, 00:00 in the goal's zone (`periods.snap_time`), so
every source - web, board, bulk, assistant, ingest - lands on it.
Changing the setting re-stamps existing check-ins (`periods.resnap`) and
recomputes. It can't be longer than `target_per` or `one_per`. Whether a
second check-in in the same period replaces or adds is still `one_per`'s
call. Forms send a moment in the middle of the picked period
(`lib/periods.ts` `midPeriod`), so a browser in another zone still lands
in it.

## Check-ins for a period, per goal (P-64)

`Goal.snap_to` (same choices) is the default for its metrics. A metric
follows it while `Metric.snap_to_goal` is set - the API shows that as
`snap_to: "goal"` ("Same as goal", the default for a new metric; the
migration gave it to every ordinary metric still at "any time", which
changed nothing since goals start at "any time"). Any other `snap_to`
value is the metric's own and clears the flag.

The stored `Metric.snap_to` is always the period IN EFFECT (shown as
`snap_period`): `MetricViewSet._snap_settings` copies the goal's on every
metric write (a moved metric takes its new goal's), and a goal change
copies it to its following metrics, re-stamps their check-ins and
recomputes (`periods.follow_plan`/`apply_follow`, P-80). So `CheckIn.save`, the replays and
the previous release's code (during a deploy) all read one field. A goal
change is refused while a following metric's `target_per`/`one_per` is
shorter; a metric following its goal is refused the same way. Template
and team-total metrics never follow (their template decides), and an
instance goal's `snap_to` is locked. Closing a cycle copies both
settings (and the metric's period-target fields) into the rolled-over
goal.

## The moment in the period, inheritance (P-80)

`SnapMoment` (abstract, on `Goal`, `Metric`, `TemplateMetric`) says WHEN in
its period a check-in is: `snap_weekday` (a week, 1 = Monday),
`snap_quarter_month` (a quarter, 1-3), `snap_month` (a year), `snap_day`
(a month, quarter or year; past the month's end = its last day) and
`snap_time` ("HH:MM", every 30 minutes) - in the goal's zone.
`periods.snap_time` stamps a check-in at that moment of its period
(`periods.moment`), which is always inside the period, so bucketing by
period (`one_per`, `shown`, the board, the client) is unchanged. The
defaults are the first day, 00:00 - what P-63 stamped - so existing rows
didn't move. Changing any of them re-stamps (`STAMP_FIELDS`).

`snap_due` makes the moment the schedule: `check_in_due_at` = the moment
of the period after the latest check-in's (`periods.due_moment`; with no
check-in yet, the creation period's moment, or the next one if that has
passed), so the dashboard's clock and the reminders (`goalnexa.reminders`,
unchanged) follow it; `check_in_every` (now also quarterly/yearly) is used
only without it. Default on for new rows, `db_default` off, so rows from
before kept their own schedule. In the generic form it's a select - a
form preselects a choice's default, not a checkbox's.

Inheritance: the whole setting (`periods.SNAP_FIELDS`) is copied, stored
as the values in effect. A sub-goal with `Goal.snap_to_parent` (API
`snap_to: "parent"`, the default for a new goal; any time for a top-level
one, `db_default` off) takes its parent goal's; a metric with
`snap_to_goal` (API `"goal"`) its parent metric's when it has one in the
same goal, else its goal's. A goal change walks down every inheriting
sub-goal and their inheriting metrics (`periods.follow_plan`, checked
against each metric's `target_per`/`one_per` BEFORE saving, then
`apply_follow`: re-stamp + refresh); a metric change does the same for its
inheriting sub-metrics (`metric_follow_plan`). Template instance and total
goals never inherit (`snap_to_parent=False`); their metrics take the
template metric's whole setting (locked).

