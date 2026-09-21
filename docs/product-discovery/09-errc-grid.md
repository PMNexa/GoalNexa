# 09 — ERRC Grid: Self-Hosted Goal Tracking System

Applying Eliminate-Reduce-Raise-Create to the value curve identified in [08 — Strategy Canvas](08-strategy-canvas.md). Every item is a HYPOTHESIS to validate, not a committed roadmap — this grid exists to find where a genuinely different value curve is possible, not to spec an MVP.

## Eliminate

Factors the whole industry assumes matter but that the evidence says actively cause churn:

- **In-app currency / pay-to-unlock mechanics.** Habitica's gold-vs-gems system is its single most-cited complaint ([03](03-customer-pain.md)). Eliminating this removes a real, documented pain source rather than a feature to preserve.
- **Per-seat pricing (team segment).** Every SaaS OKR incumbent uses it; it's the factor Operately's entire pitch is built on eliminating, and per-seat pricing has no evidence of being valued by buyers — only tolerated.
- **Mandatory accounts / telemetry by default.** OpenHabitTracker and mhabit both lead their marketing with "no sign-up, no telemetry" ([02](02-customer-jobs.md)) — a self-hosted product that still phones home or requires an account undercuts its own core value proposition.

## Reduce

Factors worth keeping but dialing down from current industry norms:

- **Deployment complexity.** Not to zero (self-hosting inherently requires *some* setup) but away from Plane's "7+ containers, ~200 env vars" extreme toward Operately's one-click-Railway-deploy model or a single-container SQLite-backed design like BeaverHabits.
- **Feature breadth per release.** The "burned out on complicated periodization" pattern ([02](02-customer-jobs.md)) and BeaverHabits' deliberate choice to ship "without Goals" both point toward a smaller, more defensible feature surface than the SaaS incumbents' reporting-depth arms race (especially Quantive's enterprise-grade canvas position in [08](08-strategy-canvas.md)).
- **Onboarding friction for the non-technical buyer**, specifically in the team segment — reduce, don't eliminate, since some setup is unavoidable for genuinely self-hosted software.

## Raise

Factors the whole industry underinvests in relative to how much the evidence says customers value them:

- **Data ownership and portability**, raised beyond "it's technically self-hosted" to include real import/export against the tools people already use instead — the Notion/Sheets/Obsidian templates documented at scale in [04 — Current Solutions](04-current-solutions.md) are the *actual* current alternative for most people; a migration path from them (not from other trackers) is a raise no competitor in [05](05-competitor-map.md) offers.
- **Maintenance/sustainability transparency.** [03 — Customer Pain](03-customer-pain.md) found self-hosted alternatives carry their own abandonment risk (an UNMAINTAINED-tagged repo, an archived okr2go). Raising a visible, credible answer to "who maintains this and how" (funding model, bus-factor disclosure, update cadence) turns a category-wide weakness into a differentiator — no competitor found in this research does this explicitly.
- **Pricing-model fairness**, matching Operately's flat-rate move but generalizing it as a principle rather than a copied price sheet.

## Create

Factors that don't exist anywhere in the current industry, per [05](05-competitor-map.md) and [06](06-pressure-test.md):

- **A single data model spanning personal habits and team OKRs.** Every competitor found picks one lane — individual habit trackers (BeaverHabits, HabitSync) or team OKR tools (Operately, Weekdone) — never both. [01 — Market Map](01-market-map.md) noted these are "functionally different products," which is true for data structure, but nothing stops a personal-goal layer and a team-goal layer sharing one self-hosted instance for, e.g., a founder who wants both their own habits and their team's OKRs in one place they run. HYPOTHESIS, untested — no evidence of demand for this combination specifically, but also no evidence against it, since no product has tried it.
- **Native integration into the self-hosting stack people already run**, not a standalone silo. [13 — Complementary Products](13-complementary-products.md) details this, but the core idea: a widget for Homepage/Heimdall-style dashboards (Homepage: 32,753 GitHub stars — a very large existing audience already viewing a startpage daily), SSO via Authelia/Authentik (which already sit in front of 26–29K-star-scale deployments), and Apprise-based notifications (already adopted by HabitSync, 17,359-star project) — none of the SaaS incumbents can do this at all, and only HabitSync among self-hosted competitors has started.
- **A funding-transparency mechanic as a product feature**, not just a GitHub Sponsors link — e.g., a public "sustainability dashboard" in the spirit of Beeminder's public `beeminder.com/meta` revenue/usage transparency page ([06](06-pressure-test.md)), applied to a self-hosted context to directly counter the abandonment-risk pain point.

## What this grid implies

INSIGHT — the create-column ideas above are the only candidates in this whole discovery process that don't already exist somewhere in [05 — Competitor Map](05-competitor-map.md). Everything in Eliminate/Reduce/Raise is a real but incremental improvement on the existing self-hosted curve (better version of BeaverHabits/Operately); the homelab-ecosystem-integration and dual-personal/team-model ideas in Create are the closest this discovery process gets to an actual blue ocean move rather than competing better within the red ocean both curves in [08](08-strategy-canvas.md) already occupy.
