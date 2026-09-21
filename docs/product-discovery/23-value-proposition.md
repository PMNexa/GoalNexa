# 23 — Value Proposition: Quantified Team

## Target customer

A technical team lead (CTO, engineering manager, or technical founder) at a **5-30 person team** that already self-hosts part of its dev/PM stack (Gitea/GitLab, Vikunja/Plane, or comparable — [01 — Market Map](01-market-map.md)), and is either currently paying for a per-seat OKR SaaS tool (Weekdone, Perdoo, Quantive) or was a Microsoft Viva Goals customer displaced by its December 2024 discontinuation ([05](05-competitor-map.md), [06 — Pressure Test](06-pressure-test.md)). Narrower than "any team that wants OKRs" — deliberately scoped to teams for whom self-hosting is already a live practice, not a hypothetical.

## Job-to-be-done

*"Keep the team's goals visible and current without anyone spending time manually re-typing progress updates, and without our software bill growing every time we hire."*

## Pain (today)

- **Per-seat pricing punishes growth** — FACT, [05 — Competitor Map](05-competitor-map.md): Weekdone alone scales from $108/mo to $2,025/mo purely by headcount.
- **Manual update overhead** — ASSUMPTION, not directly quoted anywhere in docs 01-21 ([19 — Strategic Fit](19-strategic-fit.md) flags this explicitly) but consistent with the general fragmented-toolchain and complexity-fatigue patterns documented in [02](02-customer-jobs.md) and [03](03-customer-pain.md). This is the single most important pain to confirm directly before building anything.
- **Vendor risk at the business level** — FACT: Microsoft discontinued an entire enterprise OKR product line with no self-host migration path ([05](05-competitor-map.md)).
- **The one self-hosted alternative with real traction (Operately) still requires manual updates** — FACT, [05](05-competitor-map.md) confirms no automation in Operately's feature set.

## Gain (desired)

- Always-current OKR dashboards that update themselves from work already happening in tools the team already runs.
- One flat price that doesn't change as the team grows.
- Full data ownership, self-hosted, no vendor able to discontinue the product out from under them.

## Unique value proposition

**"The self-hosted OKR tool that updates itself. Plug into the dev tools your team already runs, pay one flat price no matter how many people join, and stop manually typing progress percentages."**

This combines three factors ([07 — Industry Factors](07-industry-factors.md)) no single competitor currently owns together: automation (nobody), flat pricing (only Operately), and self-hosted trust (only the small/immature self-hosted OKR tools, none with Operately's polish).

## Reason to believe

- **Operately's real, growing traction** (559 GitHub stars, actively committed daily, [06 — Pressure Test](06-pressure-test.md)) is direct evidence the self-hosted-plus-flat-rate half of this pitch already works in market — this product isn't testing that half, only the automation half.
- **Existing per-seat spend is real and documented** ([05](05-competitor-map.md)) — the budget this product needs to redirect already exists and is being paid to competitors today, a materially easier sale than creating demand from zero ([21 — Willingness to Pay](21-willingness-to-pay.md)).
- **No competitor automates key-result computation** — confirmed absent from every product in [05 — Competitor Map](05-competitor-map.md), including Operately, Weekdone, Perdoo, and Quantive.
- **The category is already moving toward automation-adjacent positioning** — Open OKR and RUOK both lead with "AI-native" claims ([05](05-competitor-map.md), [06](06-pressure-test.md)), suggesting the market is primed for this direction even though neither has executed it with real usage data yet.

## Reasons to doubt (stated per role instruction to be skeptical during validation, not merely confirm)

- The core pain (manual-update overhead) is an inference, not evidence — see above.
- [18 — Blue Ocean Score](18-blue-ocean-score.md) scored this concept's Feasibility at only 4/10 — multiple integrations (Gitea, GitLab, Vikunja, Plane, and likely more to be broadly useful) is real, ongoing engineering cost, in tension with [09 — ERRC Grid](09-errc-grid.md)'s own Reduce-column recommendation to keep the feature surface small.
- Market Potential was scored 5/10 in [18](18-blue-ocean-score.md) — this is a narrow segment (self-hosting technical teams of a specific size range), not a mass market.
- [06 — Pressure Test](06-pressure-test.md)'s overall verdict for the team-OKR wedge is "cautiously open," not "validated" — this value proposition inherits that uncertainty.
