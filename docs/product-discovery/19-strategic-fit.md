# 19 — Strategic Fit: Top 5 Concepts Against the Evidence Base

The top 5 concepts from [18 — Blue Ocean Score](18-blue-ocean-score.md), tested against customer pain ([03](03-customer-pain.md)), market trends ([01](01-market-map.md), [06](06-pressure-test.md)), existing alternatives ([04](04-current-solutions.md)), and the [09 — ERRC Grid](09-errc-grid.md). This is the skeptical pass — the goal is to surface contradictions and weak assumptions, not confirm the scores from [18](18-blue-ocean-score.md).

## 1. Migrate-from-Notion Wizard

- **Pain fit:** weak, on closer inspection. [04 — Current Solutions](04-current-solutions.md) confirms Notion/Sheets/Obsidian templates are the dominant current alternative, but **no document in this entire research effort contains a direct quote of a Notion/Sheets user expressing dissatisfaction with their template.** The Gumroad marketplace's existence proves people build and buy these templates — it doesn't prove they want to leave them.
- **Market trend fit:** favorable but indirect — the self-hosting/data-ownership trend ([01](01-market-map.md)) supports the *positioning*, not demonstrated switching intent.
- **Existing alternatives fit:** strong — this is the one concept explicitly built to compete against the *actual* documented incumbent rather than another tracker, which no competitor in [05](05-competitor-map.md) does.
- **ERRC fit:** strong — matches the Raise column in [09](09-errc-grid.md) directly.
- **Weak assumption to flag:** the whole concept assumes latent switching intent in a population ([10 — Noncustomers](10-noncustomers.md) Tier 3) defined precisely by *never having looked for a dedicated tool* — that could mean untapped demand, or it could mean genuine satisfaction with the status quo. This is the single most important thing to test directly before investing engineering time, not to assume from the template marketplace's size alone.

## 2 / 3. One Instance, Two Layers & Solopreneur Tier

Treating these together since [18](18-blue-ocean-score.md) shows they're the same underlying segment with different packaging.

- **Pain fit:** moderate — the closest direct evidence is [02 — Customer Jobs](02-customer-jobs.md) job #4 (*"there isn't a single place where you can get both the holistic metrics and the plan"*), but that quote is about a fragmented fitness-tracking toolchain, not specifically personal-habits-plus-team-OKRs. This is a reasonable extrapolation, not a direct hit.
- **Market trend fit:** weak — no trend data in [01](01-market-map.md) or elsewhere speaks to solopreneur/1-4-person team tooling adoption specifically.
- **Existing alternatives fit:** genuinely strong — [12 — Strategic Groups](12-strategic-groups.md) confirmed this segment sits below every strategic group's practical floor (per-seat SaaS too expensive at this scale, Operately's own stated sweet spot starts at 5).
- **ERRC fit:** strong — this is the literal source of the Create-column idea in [09](09-errc-grid.md).
- **Contradiction to flag:** [01 — Market Map](01-market-map.md) explicitly argued personal and team goal tracking "are functionally different products... pick a lane." Unifying them risks recreating the exact complexity/feature-bloat pattern documented as a churn driver in [02](02-customer-jobs.md) job #6 and [03](03-customer-pain.md) pain #7 — there is a real, unresolved tension between "serve both needs in one tool" and "keep the feature surface small," and this concept doesn't yet resolve it.
- **Weak assumption to flag:** the segment was identified entirely by elimination/logic (a gap between strategic groups) — **no first-person quote or direct evidence of a solopreneur asking for this exists anywhere in docs 01-17.** This is the weakest evidentiary foundation of the top 5.

## 4. Bus-Factor Dashboard

- **Pain fit:** the strongest of the top 5 — [03 — Customer Pain](03-customer-pain.md) pain #6 is directly evidenced (an explicitly UNMAINTAINED-tagged repo, the archived okr2go project).
- **Market trend fit:** strong — [06 — Pressure Test](06-pressure-test.md)'s OSS-maintainer-burnout statistics (~60% unpaid, ~60% considered quitting) are a real, sourced trend supporting the underlying concern.
- **Existing alternatives fit:** Beeminder's `beeminder.com/meta` page is a genuine precedent, though outside this category.
- **ERRC fit:** matches the Raise column in [09](09-errc-grid.md).
- **Contradiction to flag:** this is a real risk, not just a weak assumption — **if the dashboard honestly reflects an early-stage project's actual funding status (likely near-zero, per [06](06-pressure-test.md)'s finding that no project in this category discloses meaningful sponsorship), transparency could actively surface the exact abandonment risk it's meant to counter**, rather than resolving it. A trust feature that reveals an untrustworthy-looking reality is a liability, not an asset, until the underlying sustainability story is actually solid.
- **Weak assumption to flag:** no evidence anywhere in this research shows that showing this kind of dashboard actually changes anyone's adoption decision — it's plausible, not demonstrated.

## 5. Quantified Team (auto OKRs)

- **Pain fit:** moderate, largely inferred — the closest direct evidence is [02](02-customer-jobs.md)'s fragmented-toolchain job, not a specific "manual OKR updates are a burden" quote, which was not found anywhere in this research despite being cited informally as intuitive.
- **Market trend fit:** good — [07 — Industry Factors](07-industry-factors.md) and [05](05-competitor-map.md) both note "AI-native"/automation positioning is an active, if young, trend among both Open OKR and RUOK.
- **Existing alternatives fit:** strong — confirmed genuinely absent from every competitor in [05 — Competitor Map](05-competitor-map.md).
- **ERRC fit:** matches the Create column in [09](09-errc-grid.md) directly.
- **Contradiction to flag:** building multiple automatic-capture integrations (Gitea, Vikunja, Plane, etc.) is itself a feature-breadth commitment that directly conflicts with [09 — ERRC Grid](09-errc-grid.md)'s own Reduce-column recommendation to keep the feature surface small — this concept and the "reduce complexity" principle from the same framework are in tension, and that tension isn't resolved by this analysis.

## Cross-cutting weak assumptions

INSIGHT — three of the five top concepts (Migrate-from-Notion Wizard, One Instance/Solopreneur Tier, Quantified Team) rest on a documented gap in the evidence base — **no direct customer interview, survey, or unprompted first-person complaint exists anywhere in docs 01-17 for the exact need each concept assumes.** All three are reasoned extrapolations from adjacent evidence (fragmentation complaints, competitive-group gaps, template-marketplace size), not direct hits. Bus-Factor Dashboard and, more mildly, Quantified Team are the two with a genuine internal contradiction rather than just unproven demand. **RECOMMENDATION:** none of the top 5 should be scoped into an MVP without first closing at least one of these evidence gaps directly — see [21 — Willingness to Pay](21-willingness-to-pay.md) for what's known and unknown about whether anyone would actually pay for these.
