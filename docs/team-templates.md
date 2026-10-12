# Teams, goal templates and rollups

Design for running **one goal system across many teams** of an
organization - the same goals, sub-goals and metrics, each team with its
own targets and check-ins, and totals at every level - without copying
everything by hand. Roadmap: P-48..P-53 (`docs/roadmap.md`). Status:
built (2026-10-12); "As built" at the end notes where the code differs
from this design.

## The problem

Several departments/teams need the same goal set ("Revenue" with MRR and
Deals, a "Hiring" sub-goal, ...). Today the only way is to create the
goal tree once per team, by hand. Then a rename, a new metric or a unit
fix has to be repeated everywhere, the copies drift, and there is no
total across teams.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Model | **Template + linked instances** (an instance is a normal `Goal` tree) | Every per-goal feature (progress, projection, health, reminders, digest, MCP, cycles, shared links) keeps working unchanged. Rejected: one goal with check-ins tagged by team ("segments") - no duplication, but progress/health/reminders are per goal and per metric everywhere, and per-team visibility would be impossible. |
| Where teams live | **Inside one org**, a tree of any depth | A department is just a team with children; no separate type. |
| Same metrics, different targets | Template owns the **shape**, the team owns the **numbers** | No override tracking, no drift: shape fields are locked in instances. |
| Template edits | **Pushed automatically** to every instance | Asked for. |
| Template may include | **Sub-goals** and sub-metrics | Asked for. |
| Team additions | Teams may add **local** sub-goals and metrics | Not locked, not rolled up. |
| Who edits templates | **Org owner/admin** only | Asked for. |
| Instances on | **Leaf and middle teams** | A department can have its own instance alongside its teams'. |
| Totals | A **rollup** at every team node and the org | Asked for. Computed from leaf data, never from child rollups (see Rollup). |
| Top-down targets | **Planned target** on any rollup node | Leadership's number next to the sum the teams committed, with the gap. |
| Visibility | Teams see each other now; a `team` level later | Asked for ("or even cannot in the future"). |
| Next cycle | **Targets start blank** | Each team re-commits; until then its metrics don't count. |
| Agent check-in | Resolve the speaker's team instance; ask when in several teams | Keeps "we're at 420" a one-line check-in. |
| Check-in UI | A **team board**: team rows x goal/metric columns | Asked for. The same grid edits targets. |

## Data model

### Teams (platform-org)

Generic multi-tenant structure, so it belongs in platform-org, next to
`Organization`/`OrgMembership`.

- `Team(id, org, parent -> Team | null, name, position)`.
- `TeamMembership(team, user_id, role: lead | member)` - only members of
  the team's org. A user may be in several teams.
- Team tree CRUD: org owner/admin.
- Deleting a team: org owner/admin chooses - its instances are archived
  or move to the parent team. `org_removed` deletes teams; `user_removed`
  deletes memberships.

### Goals (goalnexa)

- `Goal.team_id` - nullable bare id (like `org_id`), same org as the goal.
- `Goal.template_goal_id` - nullable; set on instance goals.
- `Goal.rollup_team_id` + `Goal.is_rollup` - set on rollup goals
  (`rollup_team_id` null = the org total). One rollup goal tree per
  (template, team node or org, cycle).
- `Metric.template_metric_id` - nullable; set on instance and rollup
  metrics.
- `Metric.planned_target` - nullable; rollup metrics only.

All new columns are nullable (no `db_default` needed), so the previous
release's code keeps working during a deploy.

### Templates (goalnexa)

- `GoalTemplate(id, org, title, description, owner_id)`.
- `TemplateGoal(id, template, parent -> TemplateGoal | null, title,
  description, position)` - the root goal and its sub-goals.
- `TemplateMetric(id, template_goal, parent -> TemplateMetric | null,
  name, unit, aggregation, check_in_every, rollup, default_base,
  default_target, position)`.
- `rollup`: `sum` | `avg` | `min` | `none` (see Rollup).

### Who owns which field

| Field | Owner | In an instance |
|---|---|---|
| Goal title, description, parent, position (template sub-goals) | template | locked |
| Metric name, unit, aggregation, schedule, parent, position | template | locked |
| Base, target, check-ins, current value, goal owner, members | team | editable |
| Goal/metric with no template link (local) | team | fully editable, not rolled up |

Locking is in the serializers (read-only when `template_*_id` is set),
so the generic CRUD screens, the API and MCP all enforce it.

## Applying a template

"Apply to teams" (template page or the team board's Targets mode) picks
team nodes - leaf or middle - and creates, per team, one instance goal
tree in the chosen cycle: every `TemplateGoal` becomes a `Goal` (team,
org, cycle set), every `TemplateMetric` a `Metric` with
`default_base`/`default_target` (blank target = `target = base`, tracked
only). The rollup goal trees for that team's ancestors and the org are
created if missing. Applying to a team that already has an instance in
that cycle is a no-op. The instance owner defaults to the team's lead.

## Automatic push

A template save updates every linked row in one transaction.

| Template change | Every instance |
|---|---|
| Rename, description, unit, schedule, reorder, re-parent | copied |
| New sub-goal / metric | created; a new metric gets `default_target` or, if none, `target = base` (tracked only: out of progress and health until the team sets a target), flagged "needs target" |
| Sub-goal / metric removed | with check-ins: **detached** (becomes local, history kept); empty: deleted |
| `aggregation` sum <-> latest | **refused** once any instance has check-ins - it changes what past check-ins mean |
| `rollup` rule | rollups recomputed |

Rollup goal trees follow the same pushes.

## Rollup

Every team node with instances in its subtree, and the org, gets a rollup
goal tree mirroring the template. A node's rollup covers **its own
instance (if any) plus every instance in its subtree**.

**Always computed from the instances, never from child rollups.** An
average of averages weighs a 2-team department like a 10-team one; `sum`
and `min` come out the same either way, so one rule serves all three.

| Rule | Value | Target | Use for |
|---|---|---|---|
| `sum` | Σ value | planned target, else Σ target (base: Σ base) | revenue, deals, km, hires |
| `avg` | mean value | planned target, else mean target | rates, NPS, scores |
| `min` | the lowest instance % | - (no planned target) | compliance, "every team must" |
| `none` | not rolled up | - | team-specific context |

Instances whose metric is tracked only (no target yet) are left out of
`sum`/`avg` targets and of `min`, so a team that hasn't committed yet
doesn't drag the total.

- **Storage**: when an instance metric changes, `refresh_metric_and_goal`
  also recomputes the rollup metrics of that team's ancestors and the
  org, and writes a **synthetic check-in** (`source="rollup"`) when the
  value changes. Chart replay, projection, health, snapshots, the digest
  and shared links then work for totals with no new code.
- Rollup goals are read-only: users can't check in, edit metrics or add
  local items. Moving a team recomputes the old and new ancestor chains.
- **Planned target** (top-down): org owner/admin on any node; a team
  lead on nodes **below** their own team (their own team's comes from
  above). The board shows planned vs Σ teams and the gap, red when the
  teams commit less than planned.

## Team board (check-in table)

A new screen, separate from the existing per-org check-in table (metrics
x dates, history), which stays as it is. One board per template and
cycle.

**Picker bar**: template, cycle, team subtree (default: the org), check-in
date (default now), mode: **Check in** | **Targets**.

```
                     │ Revenue                         │ Hiring (sub-goal)
Team                 │ MRR ($)          │ Deals (#)     │ Hires (#)
─────────────────────┼──────────────────┼───────────────┼──────────────
▾ Sales (total)      │ 82k / 100k  ⚑120k  gap -20k      │ ...   read-only
    Sales (own)      │ [ 12k ] 15k      │ [   ] 3/5  ⏰ │ ...
  ▾ North (total)    │ 40k / 50k        │ ...           │
      Team A         │ [ 22k ] 25k      │ [ 2 ] 8/10    │ [ 1 ] 1/2
      Team B         │ [     ] 18/25k   │ ...           │
  ▸ South            │ ...              │               │
```

- **Columns**: grouped headers goal -> sub-goal -> metric (unit),
  template metrics only. A team's local metrics expand in a row under it.
- **Rows**: the team tree, indented, collapsible. Leaf team: one editable
  row. Middle team with an instance: read-only **total** row + editable
  **own** row. Middle team without: total row only.
- **Cell**: current / target, an input, due clock (`isCheckInDue`),
  progress heat in health colors, note popover.
- **Input meaning**: `sum` = amount done ("+12"); `latest` = the new
  reading. Old -> new preview before saving.
- **Save**: dirty cells highlighted; "Save 7 check-ins" sends
  `POST /api/v1/check-ins/bulk` - one transaction, validated per cell,
  each affected rollup recomputed once.
- **Spreadsheet feel**: sticky team column and header, Tab/Enter
  navigation, paste a range from a spreadsheet (nice to have). Phones: a
  card per team.
- **Permissions**: a cell is editable for that team's members and lead,
  the instance owner, and org owner/admin; read-only otherwise.

**Targets mode** (same grid): leaf/own cells edit base and target; total
cells edit the planned target (⚑) and show planned vs Σ teams and the
gap; "Apply to teams" adds instances; "needs target" badges show where a
team hasn't committed.

## Permissions

| Action | Who |
|---|---|
| Team tree CRUD, team membership | org owner/admin |
| Template CRUD, apply, push | org owner/admin |
| Instance base/target, local items | team lead, instance owner, org owner/admin |
| Planned target | org owner/admin anywhere; a team lead below their team |
| Check in on an instance | team members and lead, instance owner, org owner/admin |
| Rollup goals | read-only for everyone; written by the system |

RBAC (resource verbs app-wide) still applies on top; new resources get
patterns in main's `RBAC_DEFAULT_ROLES`.

## Visibility

Now: instances and rollups follow the goal's existing `visibility`
(`public` = the whole org), so teams see each other's numbers and
targets. Later (P-53): a `team` level = the team's subtree members plus
org owner/admin. A hidden team still counts in its ancestors' totals;
its rows show only to those who can see it.

## Cycles

The template outlives cycles; instances and rollup goals live in a cycle.
Closing a cycle scores instances like any goal (rollups too, for the
record). Rollover copies each instance with its template links and
**`target = base`** for every metric (tracked only until the team sets a
target), creates the next cycle's rollup trees and clears planned
targets.

## Agent path

- Metric lookup prefers instances whose team the caller is in: a team
  filter on metrics (`filter{team_id.in}` or a `my_teams=true` shortcut).
- One match: check in. In several teams with a candidate in each: ask
  which team.
- `goalnexa/mcp_instructions.md` and the check-in skill say so; rollup
  metrics refuse check-ins with a clear error the agent relays.
- New resources (teams, team memberships, templates) are added to
  `MCP_RESOURCES` deliberately.

## Checklist per new resource

Each of `Team`, `TeamMembership`, `GoalTemplate`, `TemplateGoal`,
`TemplateMetric`:

- `BaseViewSet` + patterns in `RBAC_DEFAULT_ROLES`; `MCP_RESOURCES` entry.
- Tenant-isolation tests in `apps/main/backend/tests/` (strangers probing
  every reference field: `team_id`, `template_goal_id`, `parent`, ...).
- `upgrade_check.py`'s `RESOURCES` (user-entered fields).
- `user_removed` / `org_removed` receivers; export provider.
- OpenAPI: field `help_text`, `@extend_schema` on apply/push/bulk actions.

## Build order

| ID | Phase |
|---|---|
| P-48 | Teams: tree, membership, `Goal.team_id`, team filter on the dashboard |
| P-49 | Goal templates: template goal tree, apply to teams, locked fields, automatic push, local items |
| P-50 | Team board: the check-in/targets grid and `POST check-ins/bulk` |
| P-51 | Rollups: per team node and org, from the subtree, planned targets, synthetic check-ins |
| P-52 | Team-aware agent check-ins |
| P-53 | Team visibility |

## Open for implementation

- A goal can be in a team without a template (a team's own goal). The
  team filter should show those too.
- Whether a template can be applied to a team in another cycle mid-way
  (late joiners) - assumed yes, same as apply.
- Bulk endpoint limits (cells per request) and partial-failure shape: all
  or nothing is the default.

## As built

- **Code**: platform-org `Team`/`TeamMembership` (`views/teams.py`);
  goalnexa `goalnexa/teams.py` (team tree through core's registry, and
  every permission rule), `templates.py` (`sync_tree`, push, apply,
  removal, rollover), `rollups.py` (totals), `views/templates.py` (CRUD,
  `apply`, `board`, `targets`), `POST check-ins/bulk`. Frontend:
  goalnexa-frontend `TeamBoardScreen` (`/board`), templates' generic
  pages (`createTemplatesRoutes`), platform-org-frontend's team pages and
  `TeamMembersPanel`, a team filter on the dashboard.
- **Team deletion**: the org owner/admin's choice is the `instances` query
  parameter (`move`, the default, or `archive`). An instance can't move
  where the parent team already has one of the same template and cycle,
  and a top-level team has no parent: those are archived and detached
  from the template (their history stays as ordinary goals).
- **Team visibility** also lets a team's goal be seen by the leads of the
  teams above it - they set its targets, so hiding it from them made no
  sense. Members of a team above still don't see it.
- **Totals** are titled "<goal> · <team> total" ("· Organization total"),
  keep one synthetic check-in per day (today's is updated, so a trend is
  over days), never send milestone emails or write feed entries, and
  don't count toward an org's goal limit. Every write to an instance
  recomputes every total of its template and cycle (not only its
  ancestors) - simpler, and right after a team moves.
- **Rollover** keeps the team's copy linked to the template, with every
  target blank (= base); totals aren't copied but rebuilt.
- **Not built yet**: a card layout for phones (the grid scrolls sideways
  instead) and pasting a range from a spreadsheet into the board.
