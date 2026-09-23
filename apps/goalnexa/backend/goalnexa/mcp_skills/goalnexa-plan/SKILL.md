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

## 1. Draft

From what the user said, propose:

- **Goal**: a short outcome-style `title` ("Run a half marathon", not "Running"),
  an optional one-sentence `description`, a `target_date` (ask if there's no
  hint), and `status: "in_progress"` (or `"not_started"` if it starts later).
- **Owner**: personal by default. For a team or company goal, find the
  organization with `orgs_list` and set `org_id`. Ask if it's unclear.
- **1–4 metrics**, each measurable with one number that someone can check in:
  `name`, `unit` (short: `km`, `%`, `users`, `hours`, or empty for a count),
  `base_value` (where it stands today; ask if unknown) and `target_value`.
  - Prefer outcomes over activity ("Weekly distance 10 → 40 km" beats
    "Go running").
  - A metric that should go down gets a target below its base ("Median response
    time 12 → 2 hours").
  - Avoid yes/no metrics. If you need one, use 0 → 1.

Before creating anything, check for duplicates: `goals_list` with
`filter: {"title.icontains": "<keyword>"}`. If there's a close match, ask
whether to add metrics to it instead.

## 2. Confirm

Show the draft as a compact list and ask to confirm or adjust. Don't create
anything before the user says yes.

## 3. Create

1. `goals_create` with the goal's fields. Keep the returned `id`.
2. `metrics_create` for each metric, with `goal` = that id. `current_value`
   starts at `base_value`, so there's no need to send it.
3. For a sub-goal, set `parent` to the parent goal's id.

## 4. Wrap up

Confirm what was created (goal, due date, metrics as `base → target unit`) and
say where to see it: the dashboard at {{app_url}}/dashboard. Offer to log a first
check-in if the user already has a current number that differs from the base.
