# 21 — Willingness to Pay

**Upfront limitation, stated plainly per the discovery process's evidentiary standards:** no direct customer interview, survey, pre-order, or landing-page test was run at any point in this research. Everything below is **proxy evidence** — real, cited, but inferred from adjacent spending behavior, competitor pricing, and analogous markets, not from asking the actual target customer whether they'd pay. This is the single most important gap to close before committing engineering resources to any concept below, consistent with the recurring theme across [06](06-pressure-test.md), [10](10-noncustomers.md), and [19](19-strategic-fit.md).

Full buyer/budget/benchmark/trigger analysis on the five concepts prioritized in [18](18-blue-ocean-score.md)/[19 — Strategic Fit](19-strategic-fit.md); a condensed pass on the other nine concepts that survived [20 — Competition Test](20-competition-test.md).

## 1. Migrate-from-Notion Wizard

- **Buyer:** the individual or team currently maintaining a Notion/Sheets/Obsidian goal-tracking setup ([04](04-current-solutions.md)) — not a distinct buyer, a feature that drives adoption of whatever base product it ships with.
- **Budget source:** none directly — Notion's free tier and Google Sheets are themselves free, so there's no existing spend to redirect. This feature cannot justify its own price; it can only support the parent product's conversion funnel.
- **Pricing benchmark:** N/A as a standalone item.
- **Purchasing trigger:** not a purchase trigger at all — it's an *adoption* trigger. The actual purchase decision (if any) happens at the parent product's paid tier, triggered separately.
- **Evidence quality:** weakest in this set — there is no proxy spending data to point to, because the thing being replaced (a free Notion page) has no price to benchmark against. **RECOMMENDATION:** treat this purely as a conversion-funnel investment, not a revenue line, and don't let its high [18](18-blue-ocean-score.md) score imply monetization potential it doesn't have.

## 2 / 3. One Instance, Two Layers & Solopreneur Tier

- **Buyer:** a solo founder or 1-4-person team lead.
- **Budget source:** this is the crux problem. [12 — Strategic Groups](12-strategic-groups.md) identified this segment as underserved partly *because* per-seat SaaS OKR pricing (Weekdone: $108-2,025/mo scaling by seats, [05](05-competitor-map.md)) is uneconomical at this scale — meaning this segment self-selects for low or zero software budget by definition. A segment defined by being priced out of the existing market is not automatically a segment with money to spend on a new entrant.
- **Pricing benchmark — and a direct contradiction to flag:** Operately's own free cloud tier covers **up to 10 users at $0/month** ([06](06-pressure-test.md)). A 1-4 person team can already use Operately's team-goals features today, for free, on Operately's own hosted cloud. This substantially undercuts the WTP case for a *paid* version of this concept — the honest finding is that the gap [12 — Strategic Groups](12-strategic-groups.md) identified may be a **product-fit gap** (nobody combines personal habits with team goals) rather than a **pricing gap** (the team-goals half of this need is already served free by an incumbent).
- **Purchasing trigger:** only plausible if the differentiator is the *combination* (personal + team in one place) rather than team-goals functionality alone, since Operately's free tier already removes the pricing trigger for the team-goals-only version of this need.
- **Evidence quality:** the [18](18-blue-ocean-score.md) score for this concept should be read alongside this finding — Market Potential was already scored low (4-5/10); this WTP analysis suggests the ceiling may be lower still unless the product-fit angle (not price) is what's actually being sold.

## 4. Bus-Factor Dashboard

- **Buyer:** N/A — this is a trust-supporting feature bundled into a base product, not something sold separately.
- **Budget source:** none directly attributable.
- **Pricing benchmark:** Beeminder's public `beeminder.com/meta` transparency page is free to view and not monetized directly — the closest real-world precedent confirms this is not itself a revenue mechanism.
- **Purchasing trigger:** none — this supports retention/trust in the *parent* product's purchase decision, indirectly and unmeasurably with the evidence available.
- **Evidence quality:** consistent with its low New Demand and Market Potential scores in [18](18-blue-ocean-score.md) — this is correctly understood as a cost-of-doing-business trust feature, not a monetizable concept in its own right.

## 5. Quantified Team (auto OKRs)

- **Buyer:** a small-to-mid technical team's lead (CTO/eng manager) already running self-hosted dev tooling (Gitea, Vikunja, Plane — [01](01-market-map.md)).
- **Budget source:** **this is the strongest budget-source case of the five** — real, existing, currently-being-spent money. Teams considering this are plausible candidates to already be paying $108-2,025/month for Weekdone, or comparable amounts for Perdoo/Quantive ($9-11/user/mo, [05](05-competitor-map.md)) — the question is diverting existing spend, not creating a new budget line from zero, which is a materially easier sale than the previous three concepts.
- **Pricing benchmark:** Operately's flat-rate cloud tiers ($49/$149/$249 per month, [06](06-pressure-test.md)) are the direct comparable; a premium tier for automated key-result computation could plausibly sit above Operately's base tiers if the automation demonstrably saves admin labor time — a concrete, quantifiable ROI argument ("X hours/month of manual OKR updates eliminated") that none of the other four concepts in this document can make as cleanly.
- **Purchasing trigger:** teams currently paying for per-seat OKR SaaS and evaluating alternatives, or teams that tried OKR software before and abandoned it specifically due to update-maintenance overhead (this specific trigger is an ASSUMPTION — no direct quote of this exact complaint was found anywhere in docs 01-17, flagged already in [19 — Strategic Fit](19-strategic-fit.md)).
- **Evidence quality:** the best-grounded of the five on budget source and pricing benchmark, weakest on the purchasing-trigger assumption. **RECOMMENDATION:** if only one concept from this whole discovery process gets a direct validation test (a landing page, a founder-led sales conversation with 5-10 self-hosting technical team leads), this is the strongest candidate — it's the only one with a demonstrable existing budget line to redirect rather than a budget line that would need to be created from nothing.

## Condensed pass — remaining nine survivors from [20 — Competition Test](20-competition-test.md)

| Concept | Buyer | Budget source | Pricing benchmark | Purchasing trigger | WTP evidence quality |
|---|---|---|---|---|---|
| Stake & Self-Host (#2) | Individual wanting real stakes | Discretionary personal spend | Beeminder (~$983K/yr revenue after 15 years, [06](06-pressure-test.md)); StickK (free, optional $5+/period stakes) | Repeated failure with cosmetic gamification | Moderate — real but small proven market (Beeminder), not proof a self-hosted version converts similarly |
| Auto-Habit passive capture (#4) | Technical individual with existing data sources | Discretionary | No direct self-hosted comparable found | Frustration with manual re-entry of data tracked elsewhere | Weak — no pricing precedent found for this specific mechanism |
| Pay What You Fail, charity (#10) | Same as Stake & Self-Host, ethically motivated subset | Discretionary, routed to charity not vendor | N/A — by design, no vendor revenue captured directly | Same as #2, plus discomfort with Beeminder's for-profit stakes model | Weak on vendor monetization specifically, since funds bypass the vendor by design |
| Managed-Install Consultancy Kit (#13) | Non-technical SMB owner, via an IT consultancy partner | Existing SMB IT/software budget | GitLab self-managed TCO analysis ($81,934/yr premium over SaaS at small scale, [06](06-pressure-test.md)) sets an upper bound on what installation/maintenance services could command | Business wants self-hosting but lacks in-house Docker skills | Moderate — the buyer and budget both plausibly exist (general SMB IT spend), but no self-hosted-goal-tracker-specific benchmark found |
| Compliance Mode (#12) | Government/healthcare/defense team with a hard data-residency requirement | Regulated-sector compliance/procurement budget | OpenProject Enterprise on-prem (~€5.95/user/mo, [05](05-competitor-map.md)) is the closest available on-prem-specific benchmark | A hard regulatory blocker, not a preference | Weakest of all — [06 — Pressure Test](06-pressure-test.md) explicitly flagged this segment as untested; genuinely unknown whether it exists at the size needed |
| Homelab Widget (#1) | Existing self-hosting hobbyist | N/A — likely a free feature of a free/freemium product | N/A | Already running a Homepage-style dashboard | Not independently monetizable — a retention/distribution feature, not a revenue line |
| Federated Accountability Pods (#7) | Self-hosting friend/team groups | Discretionary, split across a group | No direct comparable found | Wanting shared challenges without a central company | Very weak — smallest, least-evidenced buyer population in this set |
| Ambient Physical Display (#19) | Hardware-tinkering self-hoster | Discretionary, likely willing to buy physical hardware once | Synology/Unraid-style appliance pricing ($150-500+ typical NAS hardware range, general market knowledge, not independently verified this pass) is the loose analogue | Wants a screen-free ambient display | Weak — real analogous hardware-purchase behavior exists in the category, but no evidence anyone wants it for *this specific* use case |
| Verified Referee Network (#20) | Self-hosting individuals wanting decentralized commitment verification | Discretionary | No direct comparable found | Distrust of centralized commitment-device companies | Very weak — smallest, most speculative population in this set |

## Overall synthesis

INSIGHT — across all 14 surviving concepts, exactly **one** (Quantified Team) has a clean, evidenced case of an existing budget line that could be redirected rather than a new one that would need to be created. Every other concept either has no direct monetization path of its own (Migrate-from-Notion, Bus-Factor Dashboard, Homelab Widget — all support a parent product rather than standing alone) or asks a segment with a documented reason to be price-sensitive (solopreneurs priced out of per-seat SaaS, individuals already skeptical of subscriptions per [03 — Customer Pain](03-customer-pain.md)) to pay for something new.

**RECOMMENDATION:** the next concrete step this research supports is not building any of these — it's a small number of direct conversations with self-hosting technical team leads currently paying for per-seat OKR SaaS, testing the Quantified Team concept's ROI pitch specifically, since it's the only concept in this entire 20-idea set with a demonstrable existing willingness to pay to redirect. Every other concept requires validating demand from zero, which this desk research cannot do and should not be assumed to have already done.
