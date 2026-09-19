# Product Discovery — Self-Hosted Goal Tracking System

Discovery-stage research for the idea: *a self-hosted (run-it-on-your-own-server) system for tracking personal or team goals — habits, resolutions, OKRs, milestones.*

This is Phase 1 discovery (market/customer/competitive mapping). It intentionally stops short of a Go/Pivot/Kill recommendation — that requires the problem-validation and Blue Ocean strategy work that follows once these maps are reviewed.

## Documents

1. [Market Map](01-market-map.md) — segments, market size, business models, trends
2. [Customer Jobs](02-customer-jobs.md) — JTBD ranked by importance/frequency
3. [Customer Pain](03-customer-pain.md) — frustrations and unmet needs, ranked by severity
4. [Current Solutions](04-current-solutions.md) — how people solve this today, direct to analog to "nothing"
5. [Competitor Map](05-competitor-map.md) — direct/indirect competitors compared
6. [Pressure Test](06-pressure-test.md) — actively tries to falsify the docs 01–05 "gap" thesis; **read this one first** — it overrides the headline below

## Evidence conventions used throughout

- **FACT** — directly supported by a cited source.
- **ASSUMPTION** — currently believed but unverified.
- **HYPOTHESIS** — a proposition that needs testing.
- **INSIGHT** — a conclusion drawn from triangulating multiple observations.
- **RECOMMENDATION** — a proposed product decision.

Where research hit a wall (blocked Reddit access, unconfirmed primary sources, thin data), it is flagged explicitly rather than papered over. The single biggest gap across all five documents: **no direct-from-Reddit user-voice data** (r/selfhosted, r/getdisciplined) — WebFetch access to reddit.com was blocked during this research pass. This should be the first follow-up before writing a PRD.

## Headline insight (revised twice — see [06](06-pressure-test.md) for full history)

The initial read — "team/OKR self-hosting is empty whitespace" — doesn't survive scrutiny, but neither did the pressure test's own first-pass "likely KILL" call. No positive demand signal for team-OKR self-hosting was found anywhere searched (HN, G2, Capterra, Lemmy). But the two strongest-looking pieces of *counter*-evidence — Microsoft Viva Goals refugees migrating to other SaaS, and GitLab-scale TCO math — both turned out to rest on mismatched comparables (Viva Goals buyers are Microsoft-ecosystem-locked enterprises, not the small teams this wedge targets; GitLab-HA infra costs don't transfer to a lightweight one-click-deployable tracker on Coolify/PikaPods). Net: **team-OKR self-hosting is UNRESOLVED, not KILLed** — no evidence for it, no solid evidence against it either, which makes it a cheap-validation candidate (landing page + one-click prototype), not a build-or-abandon call desk research alone can make.

Self-hosted **individual habit tracking** fares better but still modestly: it's a real, moderately active open-source category (Loop Habit Tracker/uhabits: 10k+ GitHub stars, though local-only with no server; BeaverHabits, HabitSync: smaller but genuinely self-hostable), with some direct evidence of self-hosting-specific motivation (data ownership, avoiding platform risk). But engagement is thin everywhere tested (a Lemmy "what do you use" thread drew 7 replies; Show HN launches drew 0-2 points), and **no project in this category shows any disclosed revenue or meaningful sponsor count** — contrasted against self-hosted categories that do monetize well (Vaultwarden: 193 disclosed sponsors; Plausible: $1M+ ARR). This is a **PIVOT-toward-narrower-validation** situation, not a GO: real but small signal, unproven monetization, and a residual research gap (Reddit access was blocked this pass — see [06](06-pressure-test.md) for what was substituted and what still needs checking).
