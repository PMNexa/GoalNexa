# Product Discovery — Self-Hosted Goal Tracking System

Discovery-stage research for the idea: *a self-hosted (run-it-on-your-own-server) system for tracking personal or team goals — habits, resolutions, OKRs, milestones.*

This spans Phase 1 discovery (market/customer/competitive mapping) and Phase 2 Blue Ocean strategy work (value curve, ERRC, noncustomers). It intentionally stops short of a final Go/Pivot/Kill recommendation — that requires direct validation (see recommendations in [06](06-pressure-test.md) and [12](12-strategic-groups.md)) this desk research alone can't produce.

## Documents

**Phase 1 — Market & customer discovery**

1. [Market Map](01-market-map.md) — segments, market size, business models, trends
2. [Customer Jobs](02-customer-jobs.md) — JTBD ranked by importance/frequency
3. [Customer Pain](03-customer-pain.md) — frustrations and unmet needs, ranked by severity
4. [Current Solutions](04-current-solutions.md) — how people solve this today, direct to analog to "nothing"
5. [Competitor Map](05-competitor-map.md) — direct/indirect competitors compared
6. [Pressure Test](06-pressure-test.md) — actively tries to falsify the docs 01–05 "gap" thesis, then twice self-corrects; **read this one first** — it overrides the headline below

**Phase 2 — Blue Ocean strategy**

7. [Industry Factors](07-industry-factors.md) — what companies compete on today, ranked by customer importance
8. [Strategy Canvas](08-strategy-canvas.md) — value curves for individual and team segments, dominant competitive pattern
9. [ERRC Grid](09-errc-grid.md) — Eliminate/Reduce/Raise/Create applied to the value curve
10. [Noncustomers](10-noncustomers.md) — three tiers, why each rejects/avoids/ignores existing solutions
11. [Alternative Industries](11-alternative-industries.md) — commitment devices, quantified-self, PKM tools, coaching — transferable value props
12. [Strategic Groups](12-strategic-groups.md) — six groups by price/quality/complexity/convenience/segment, and the gaps between them
13. [Complementary Products](13-complementary-products.md) — the self-hosting ecosystem (dashboards, SSO, notifications, backups) around the core product

**Phase 3 — Ideation**

14. [Blue Ocean Concepts](14-blue-ocean-concepts.md) — 20 value-curve-shifting ideas, each grounded in a specific prior finding
15. [Break Industry Assumptions](15-break-assumptions.md) — 10 load-bearing industry beliefs, challenged with alternatives
16. [Cross-Industry Inspiration](16-cross-industry-inspiration.md) — 10 business models from other industries, with the transferable mechanism
17. [Demand Creation](17-demand-creation.md) — maps all 20 concepts to the noncustomer tiers from [10](10-noncustomers.md) and the new demand each could create

**Phase 4 — Validation and prioritization**

18. [Blue Ocean Score](18-blue-ocean-score.md) — all 20 concepts scored and ranked on customer value, differentiation, new demand, market potential, feasibility, competitive resistance
19. [Strategic Fit](19-strategic-fit.md) — top 5 concepts stress-tested against pain/trends/alternatives/ERRC; surfaces contradictions and weak assumptions
20. [Competition Test](20-competition-test.md) — eliminates 6 of 20 concepts as "compete better," not new market space
21. [Willingness to Pay](21-willingness-to-pay.md) — buyer/budget/benchmark/trigger for the surviving concepts; **only one concept has a demonstrable existing budget to redirect**

**Phase 5 — Concept development**

22. [Winner](22-winner.md) — Quantified Team (self-updating self-hosted OKRs), selected on willingness-to-pay evidence over raw novelty score
23. [Value Proposition](23-value-proposition.md) — target customer, JTBD, pain, gain, UVP, reasons to believe *and* reasons to doubt
24. [Business Model](24-business-model.md) — three models compared (open-core cloud, modular automation add-on, managed-install/support); recommends starting with a hybrid of the first two
25. [MVP](25-mvp.md) — a concierge/Wizard-of-Oz stage before any automation engineering, then a single-connector buildable MVP
26. [Experiment](26-experiment.md) — 30-day validation plan with pre-committed GO/PIVOT/KILL thresholds; willingness-to-pay alone can kill the concept regardless of other signals

**Phase 6 — Adversarial stress-test and final call**

27. [Red Team](27-red-team.md) — hostile competitor/investor case; finds the automation differentiator doesn't require self-hosting and is copyable by incumbents
28. [Pre-Mortem](28-pre-mortem.md) — 10 most likely failure causes, three years out
29. [Moat](29-moat.md) — weak on 5 of 7 dimensions; only ecosystem distribution and lean cost structure hold up
30. [Market Timing](30-market-timing.md) — favorable for self-hosting generally, not clearly favorable for this specific buyer/trigger
31. [**Final Decision: PIVOT**](31-final-decision.md) — not GO, not KILL; run the 30-day experiment, re-scope around what a SaaS incumbent genuinely can't copy

## Evidence conventions used throughout

- **FACT** — directly supported by a cited source.
- **ASSUMPTION** — currently believed but unverified.
- **HYPOTHESIS** — a proposition that needs testing.
- **INSIGHT** — a conclusion drawn from triangulating multiple observations.
- **RECOMMENDATION** — a proposed product decision.

Where research hit a wall (blocked Reddit access, unconfirmed primary sources, thin data), it is flagged explicitly rather than papered over. The single biggest gap across all five documents: **no direct-from-Reddit user-voice data** (r/selfhosted, r/getdisciplined) — WebFetch access to reddit.com was blocked during this research pass. This should be the first follow-up before writing a PRD.

## Headline insight (revised three times — see [06](06-pressure-test.md) for full history)

Neither the original "team/OKR self-hosting is empty whitespace" read nor the pressure test's own follow-up "likely KILL" call survived scrutiny. The two strongest pieces of counter-evidence (Microsoft Viva Goals refugees migrating to other SaaS; GitLab-scale TCO math) rested on mismatched comparables — Viva Goals buyers are Microsoft-ecosystem-locked enterprises, not the small teams this wedge targets, and GitLab-HA infra costs don't transfer to a lightweight one-click-deployable tracker. Then a further check found a **direct existence proof**: [Operately](https://github.com/operately/operately) — open-source, self-hostable (free, unlimited) + flat-rate paid cloud, 559 GitHub stars, actively committed daily, built almost exactly for this wedge's target (teams of 5-100). Net: **team-OKR self-hosting is CAUTIOUSLY OPEN, not KILLed and not a blank slate either** — a smaller player has already validated the shape works and is growing; the real strategic question is differentiation against Operately, not whether the category can exist.

Self-hosted **individual habit tracking** fares better but still modestly: it's a real, moderately active open-source category (Loop Habit Tracker/uhabits: 10k+ GitHub stars, though local-only with no server; BeaverHabits, HabitSync: smaller but genuinely self-hostable), with some direct evidence of self-hosting-specific motivation (data ownership, avoiding platform risk). But engagement is thin everywhere tested (a Lemmy "what do you use" thread drew 7 replies; Show HN launches drew 0-2 points), and **no project in this category shows any disclosed revenue or meaningful sponsor count** — contrasted against self-hosted categories that do monetize well (Vaultwarden: 193 disclosed sponsors; Plausible: $1M+ ARR). This is a **PIVOT-toward-narrower-validation** situation, not a GO: real but small signal, unproven monetization, and a residual research gap (Reddit access was blocked this pass — see [06](06-pressure-test.md) for what was substituted and what still needs checking).

## Phase 2 headline insight

The strategy-canvas work in [08](08-strategy-canvas.md) found the whole industry really only occupies two value curves — a "SaaS curve" (high convenience, low trust/pricing-fairness) and a "self-hosted curve" (high trust, low convenience) — and Operately is the only competitor found anywhere in this research that has pulled the self-hosted curve up on convenience without giving up its ownership advantage. The most defensible, falsifiable opportunities that survive [12 — Strategic Groups](12-strategic-groups.md)'s gap analysis are narrower than the original idea: (1) do for individual habit tracking what Operately did for team OKRs (nobody has), and (2) integrate natively into the self-hosting ecosystem — Homepage dashboards (32,753 stars), Authelia/Authentik SSO (29,017/25,647 stars), Apprise notifications (17,359 stars) — that the most under-served noncustomer tier ([10](10-noncustomers.md): self-hosting hobbyists who've never extended the practice to goal tracking) already lives inside daily. No competitor, including Operately, currently does this.

## Phase 3 headline insight

[17 — Demand Creation](17-demand-creation.md) found 11 of the 20 ideas in [14 — Blue Ocean Concepts](14-blue-ocean-concepts.md) target Tier 3 noncustomers (self-hosting hobbyists, Notion/Sheets/Obsidian users) — the same segment Phase 2 already flagged as most reachable — by extending a behavior that audience already practices rather than asking for a new one. The lowest-validation-risk concepts are ecosystem-native ones (Homepage widget, SSO-by-default, Apprise notifications, a Notion/Sheets migration wizard) and the solopreneur/1-4-person tier gap; the highest-risk-highest-reward ones (financial stakes, ambient physical displays, federated accountability) import proven mechanisms from other industries ([16](16-cross-industry-inspiration.md)) but have zero evidence of appetite within this specific category yet. The large "do nothing" noncustomer segment (~80% resolution-failure rate, [04](04-current-solutions.md)) remains out of reach of every concept generated — none of this ideation claims to solve sustained motivation itself, only to remove adoption friction for people who already have some intent to track.

## Phase 4 headline insight

[20 — Competition Test](20-competition-test.md) eliminated 6 of the 20 concepts as incremental feature-matching rather than new market space (three had already been quietly overtaken by HabitSync or the existing Notion-template economy). Of the 14 survivors, [19 — Strategic Fit](19-strategic-fit.md) found that three of the top five rest on **zero direct customer quote anywhere in docs 01-17** — they're reasoned extrapolations from adjacent evidence, not validated needs. [21 — Willingness to Pay](21-willingness-to-pay.md) then found only **one of the 14 surviving concepts — Quantified Team (automated OKR key-result tracking)** — has a demonstrable *existing* budget line (current per-seat OKR SaaS spend, $9-2,025+/month depending on team size) that could plausibly be redirected; every other concept would need to create willingness to pay from zero, in market segments several of which (solopreneurs priced out of per-seat SaaS, subscription-averse individuals per [03](03-customer-pain.md)) have a documented reason to resist paying at all.

## Phase 5 headline insight

[22 — Winner](22-winner.md) selected Quantified Team over the higher-scoring Migrate-from-Notion Wizard specifically because willingness-to-pay evidence, not novelty, is this discovery process's real bar. [23](23-value-proposition.md) and [24 — Business Model](24-business-model.md) built out the full pitch and three pricing models around it — but [23](23-value-proposition.md) also states plainly that the concept's central pain (manual-OKR-update overhead) has never been directly quoted by a real customer anywhere in this entire research effort. That gap is why [25 — MVP](25-mvp.md) and [26 — Experiment](26-experiment.md) both refuse to recommend building the automation engine before running a 30-day, no-code concierge test with 5-8 design-partner teams.

## Phase 6 headline insight — final decision: PIVOT

[27 — Red Team](27-red-team.md) found the sharpest problem in the entire 31-document research effort: the automation differentiator **doesn't require self-hosting** — any SaaS incumbent (Weekdone, Perdoo, Quantive) or the better-distributed self-hosted incumbent (Operately) could copy it without adopting this product's hardest constraint. [28 — Pre-Mortem](28-pre-mortem.md) and [29 — Moat](29-moat.md) confirmed this isn't a one-off objection — the concept is weak on 5 of 7 moat dimensions, and [30 — Market Timing](30-market-timing.md) found the one real-world trigger event this research could observe (Viva Goals refugees) moved to other SaaS, not self-hosting, undercutting the "why now" urgency case. **[31 — Final Decision](31-final-decision.md) calls PIVOT, not GO or KILL**: the willingness-to-pay evidence from Phase 4 is real and shouldn't be discarded, but the concept as scoped in Phase 5 needs to re-center on what a SaaS incumbent genuinely can't copy — ecosystem-native distribution and self-hosted trust ([07](07-industry-factors.md), [13](13-complementary-products.md)) — rather than automation alone, and must clear the [26 — Experiment](26-experiment.md) validation gate before any build commitment. Per [06 — Pressure Test](06-pressure-test.md)'s own history of needing two corrections after acting on incomplete evidence, a future KILL-level signal on this specific concept should route back to the runner-up concepts in [18 — Blue Ocean Score](18-blue-ocean-score.md), not be read as proof the entire self-hosted-goal-tracking opportunity is dead.
