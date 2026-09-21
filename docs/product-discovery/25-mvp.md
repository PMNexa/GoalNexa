# 25 — MVP: Smallest Testable Version of Quantified Team

Per PM principle 16 ("do not recommend building an MVP simply because the idea sounds interesting"), this document deliberately sequences validation *before* the smallest buildable product, not straight to it — [23 — Value Proposition](23-value-proposition.md) flagged the core pain (manual-update overhead) as an unverified ASSUMPTION, and building automation infrastructure to test an unconfirmed pain would invert the correct order of operations (per the discovery process's own Customer → Job → Problem → ... → Validation sequence).

## Stage 0 — Concierge MVP (no software beyond a spreadsheet/dashboard, days not weeks)

Before building any automation engine, manually replicate the value proposition for 3-5 design-partner teams: pull their Gitea/GitLab commit data and Vikunja/Plane task-completion data by hand (or a throwaway script), and manually populate a shared OKR dashboard for them weekly, framed explicitly as "this is what the automated product will do." This is a Wizard-of-Oz test of the actual value proposition — always-current OKRs without them doing the data entry — with zero integration-engineering risk.

- **What it tests:** whether the core pain is real (do teams notice and value not having to update this themselves?) and whether the JTBD in [23](23-value-proposition.md) is accurately stated, before committing to the highest-risk part of [18 — Blue Ocean Score](18-blue-ocean-score.md)'s Feasibility score (4/10).
- **What it explicitly does NOT test:** self-hosting deployment experience, flat-rate pricing acceptance, or willingness to pay in a real transaction (no money changes hands at this stage) — those come next.

## Stage 1 — MVP proper (buildable in weeks, not the full product)

If Stage 0 shows design partners genuinely value and use the manually-populated dashboard for at least 3-4 consecutive weeks without prompting:

- **Scope:** a single-container, self-hostable OKR tracker (SQLite-backed, matching BeaverHabits' minimal-infrastructure pattern rather than Operately's fuller stack) with:
  - Manual OKR creation and check-ins (matching Operately's baseline — this part is well-precedented, not the risk)
  - **Exactly one** automatic data connector — Git commit activity (Gitea/GitLab), chosen because it's the most universally present tool in this audience's stack ([01 — Market Map](01-market-map.md)) and the simplest API surface to integrate against, not Vikunja/Plane/multiple connectors as in the full concept.
  - One-click deploy via Railway or Coolify, matching the deployment-ease bar Operately already set ([06 — Pressure Test](06-pressure-test.md)) — a self-hosted product that's harder to deploy than the incumbent loses on a factor ranked HIGH in [07 — Industry Factors](07-industry-factors.md) before it even gets evaluated on its differentiator.
  - Flat-rate pricing framing from day one (even if the MVP is free/beta), not per-seat — the pricing model itself is part of what's being tested, not just a later decision.
- **Explicitly excluded from the MVP:** Vikunja/Plane connectors, the Bus-Factor Dashboard concept, Compliance Mode, any social/federation features — all deferred per [09 — ERRC Grid](09-errc-grid.md)'s Reduce-column principle to keep the feature surface small until the core hypothesis is confirmed.

## What "genuinely value and will pay" looks like operationally

Borrowing directly from [21 — Willingness to Pay](21-willingness-to-pay.md)'s finding that this concept's strength is a redirectable existing budget, the MVP's core test is not "do people sign up for free" but **"will a team stop paying for or evaluating Weekdone/Perdoo/Quantive in favor of this."** A free-tier signup number alone would not validate willingness to pay — see [26 — Experiment](26-experiment.md) for the specific metric design that avoids this trap.

## Explicit non-goals

- Not testing the individual habit-tracking segment — that's a different opportunity ([12 — Strategic Groups](12-strategic-groups.md)) not selected as the winner here.
- Not testing Model C (managed-install/support contract) from [24 — Business Model](24-business-model.md) — that requires an entirely different, slower validation motion (direct enterprise sales conversations) incompatible with a fast MVP cycle.
- Not trying to out-feature Operately on anything except automation — matching its baseline (manual OKRs, flat pricing, one-click deploy) is sufficient; exceeding it elsewhere is scope creep at this stage.
