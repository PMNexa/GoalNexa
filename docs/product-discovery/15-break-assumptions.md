# 15 — Breaking Industry Assumptions

Assumptions every competitor in [05 — Competitor Map](05-competitor-map.md) implicitly shares, each challenged with an alternative grounded in prior research. These are the load-bearing beliefs [08 — Strategy Canvas](08-strategy-canvas.md) shows the whole industry has converged on without anyone testing them directly.

## 1. "Goal tracking must be a screen-based app the user opens and checks daily."

Every competitor found — SaaS or self-hosted — is a dedicated app or web UI. **Alternative:** ambient/passive presentation (dashboard widget, physical e-ink display, notification-only) removes the "remember to open the app" step that [02 — Customer Jobs](02-customer-jobs.md) shows causes churn (*"I'd add 6 habits, miss a day, feel guilty, stop opening the app"*). See concepts #1, #19 in [14](14-blue-ocean-concepts.md).

## 2. "Team OKR software must price per seat."

Weekdone, Perdoo, and Quantive all price per user ([05](05-competitor-map.md)) — the assumption is so uniform it isn't even marketed as a choice. **Alternative:** flat-rate pricing, already proven viable by Operately's "add people without adding costs" pitch and real, growing traction ([06 — Pressure Test](06-pressure-test.md)) — the one assumption in this list already partially broken by an existing competitor, which is exactly why [12 — Strategic Groups](12-strategic-groups.md) treats Operately as the strategic benchmark, not just another row in a table.

## 3. "Self-hosted inherently means lower convenience than SaaS."

Reinforced by Plane's documented "VERY BAD SELF HOSTING EXPERIENCE" ([05](05-competitor-map.md)) and the general self-hosting-fatigue literature cited in [06](06-pressure-test.md). **Alternative:** one-click deploy platforms (Coolify, CapRover, PikaPods, Railway) have already closed most of this gap for anyone willing to build for them — Operately's Railway deploy is the existence proof. The assumption was true when GitLab-scale infrastructure was the reference point; it is no longer true for lightweight single-container software.

## 4. "Motivation requires gamification — points, currency, or streaks."

Habitica (RPG/currency) and every streak-based tracker share this assumption; it is also the single largest source of documented complaints in [03 — Customer Pain](03-customer-pain.md) (pay-to-unlock frustration, streak anxiety). **Alternative:** either go further toward genuine stakes (financial commitment devices, [11 — Alternative Industries](11-alternative-industries.md)) or go the opposite direction entirely — trend-based, streakless presentation (concept #16, [14](14-blue-ocean-concepts.md)) — rather than the industry's default middle ground of cosmetic gamification, which draws complaints from both directions.

## 5. "Individual habit tracking and team OKR tracking are separate products for separate markets."

[01 — Market Map](01-market-map.md) itself adopted this framing early on ("functionally different products... pick a lane"). **Alternative:** no competitor has tested a single data model spanning both, and the strategic-groups gap analysis ([12](12-strategic-groups.md)) found a specific underserved segment — the 1-4-person team/solo-founder — for whom this separation is actively unhelpful, since their personal and team goals are the same handful of priorities.

## 6. "Open source means no sustainable business model — it's donation-only hobbyware."

[06 — Pressure Test](06-pressure-test.md) found this is *nearly* true in this specific category (no disclosed revenue in any pure habit/OKR self-hosted project) — but the assumption is false at the industry level. Vaultwarden (193 sponsors), Plausible ($1M+ ARR), and Operately's own flat-rate cloud tiers all disprove it in adjacent or identical categories. **Alternative:** the open-core/hosted-cloud model, proven elsewhere, has simply not been executed well yet *in this specific niche* — that's a gap to fill, not evidence the model can't work here.

## 7. "The competitive set is other goal-tracking apps."

Every competitor analysis in this industry (including the first pass of this research, before [04 — Current Solutions](04-current-solutions.md) corrected it) implicitly benchmarks against other trackers. **Alternative:** the evidenced dominant current alternative is Notion pages, Google Sheets, and Obsidian vaults — a large, active template economy, not competing software. A product built to feel familiar to and easily migrate from *those* tools competes on a completely different, less crowded axis than one built to out-feature Habitica.

## 8. "More integrations and AI features equal more value."

Open OKR and RUOK both lead with "AI-native" positioning ([05](05-competitor-map.md), [06](06-pressure-test.md)) as if AI features are self-evidently valuable. **Alternative:** [07 — Industry Factors](07-industry-factors.md) found trust and pricing fairness rank above feature depth in every complaint pattern examined — the "burned out on complicated periodization" pain in [02](02-customer-jobs.md) is direct evidence that feature accumulation can actively drive users away, not just fail to retain them.

## 9. "Being self-hosted solves vendor/abandonment risk."

Implicit in every self-hosted product's marketing (*"your data always stays yours"*). **Alternative:** [03 — Customer Pain](03-customer-pain.md) found self-hosted projects carry their own real abandonment risk (an explicitly UNMAINTAINED-tagged repo, an archived okr2go) — trust has to be actively engineered (funding transparency, data-portability guarantees) rather than assumed to follow automatically from the license.

## 10. "Social/accountability features require building a proprietary community (guilds, leaderboards, friend graphs)."

Habitica's guilds and HabitSync's leaderboards ([05](05-competitor-map.md)) both build this in-house. **Alternative:** federating accountability across independently self-hosted instances, or simply piping check-ins into a Discord/Slack/Matrix channel the user's group already has, avoids building and moderating a social platform at all — a genuinely different cost structure and risk profile for a small team to build against.

## Strategic read

INSIGHT — assumptions 1, 5, and 10 are the three where breaking them changes the *product's fundamental shape* (interface, data model, social architecture) rather than a business decision layered on top of an otherwise-conventional tracker. Per [14 — Blue Ocean Concepts](14-blue-ocean-concepts.md), these correspond to the concepts most clearly outside the existing strategy canvas, and are the highest-priority candidates for direct validation before committing to a build.
