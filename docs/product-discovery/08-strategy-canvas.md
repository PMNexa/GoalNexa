# 08 — Strategy Canvas: Self-Hosted Goal Tracking System

Value curves for the major players identified in [05 — Competitor Map](05-competitor-map.md), scored 1 (low/absent) to 5 (high) on the factors ranked in [07 — Industry Factors](07-industry-factors.md). Scores are ASSUMPTION-level estimates derived from documented features/pricing/complaints, not a measured customer survey — treat relative position (who's high vs. low on a factor) as more reliable than exact scores.

## Individual habit/goal tracking canvas

| Factor | Habitica | Beeminder | Strides/Way of Life | BeaverHabits/HabitSync (self-hosted) |
|---|---|---|---|---|
| Trust/data ownership | 2 (governance controversy) | 3 | 3 | 5 (you own the server) |
| Pricing fairness | 2 (pay-to-unlock currency) | 3 (penalty model, polarizing) | 2 (subscription resentment) | 5 (free) |
| Reliability | 2 (crash complaints) | 4 | 3 (sync complaints) | 3 (small projects, unconfirmed at scale) |
| Simplicity | 2 (cluttered per reviews) | 3 | 4 | 4 (BeaverHabits explicitly minimal) |
| Gamification/motivation mechanic | 5 (RPG, core feature) | 5 (financial stakes, unique) | 2 | 1 (none) |
| Deployment ease | 5 (nothing to deploy) | 5 (nothing to deploy) | 5 (nothing to deploy) | 2 (Docker required, no one-click ecosystem found yet) |
| Cross-platform | 4 | 4 | 2 (iOS-heavy) | 3 (self-hosted web + varies) |

**Dominant pattern:** every SaaS competitor clusters high on deployment-ease and cross-platform, and differentiates almost entirely on *motivation mechanic* (gamification vs. financial penalty vs. plain simplicity) while converging on the same weak spot — trust and pricing fairness. Self-hosted alternatives invert this exactly: high trust/ownership/price, but weak on deployment ease and near-zero on motivation mechanics (none of BeaverHabits/HabitSync builds a distinctive "why keep coming back" hook — they rely on the self-hosting motivation alone to retain users).

## Team/OKR tracking canvas

| Factor | Weekdone | Perdoo | Quantive | Microsoft Viva Goals (discontinued) | Operately | Open OKR (pre-production) |
|---|---|---|---|---|---|---|
| Deployment-model trust | 2 (SaaS-only, no on-prem) | 2 | 2 | 1 (discontinued with no migration path) | 5 (self-host free/unlimited) | 5 (self-host, but unproven) |
| Pricing model fairness | 2 (per-seat) | 2 (per-seat) | 2 (per-seat) | 2 (was per-seat) | 5 (flat-rate, "add people without adding cost") | 4 (free, license model TBD) |
| Alignment/reporting depth | 4 | 4 | 5 (enterprise-grade) | 4 | 3 (newer, smaller feature set) | 2 (Phase 1 of 8) |
| Ease of adoption (non-technical) | 5 (pure SaaS) | 5 | 4 (enterprise onboarding) | 5 | 4 (one-click Railway deploy narrows the gap) | 1 (Docker/K8s required) |
| Integrations | 3 | 3 | 4 | 5 (native M365/Teams) | 3 (unconfirmed depth) | 4 (Slack/Teams/WhatsApp/Telegram claimed) |

**Dominant pattern:** the SaaS incumbents cluster tightly high on ease-of-adoption and reporting depth, and uniformly low on deployment-model trust and pricing-model fairness — the same weak spot the Viva Goals discontinuation exposed for the whole cluster. Operately is the one entrant plotting a genuinely different curve: it doesn't try to match Quantive's enterprise reporting depth, it wins on deployment trust and pricing fairness while staying "good enough" on ease of adoption via one-click deploy. Open OKR gestures at the same curve but hasn't executed it (still requires Docker/K8s, feature set unbuilt).

## What this canvas tells us

INSIGHT — there are really only two curves in this market today, not many: (1) **the SaaS curve** — high convenience and reporting depth, low trust/pricing-fairness — occupied by nearly every incumbent regardless of individual/team segment, and (2) **the self-hosted curve** — high trust/ownership, low convenience — occupied by the small open-source projects. Operately is the only product found in this entire research effort that has meaningfully pulled the self-hosted curve up on convenience (one-click deploy, flat pricing) without abandoning the ownership advantage. That is the specific move [09 — ERRC Grid](09-errc-grid.md) should generalize from, not a call to copy Operately's feature set.
