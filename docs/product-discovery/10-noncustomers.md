# 10 — Noncustomers: Self-Hosted Goal Tracking System

Blue Ocean's three tiers of noncustomers, applied against the evidence gathered in [02](02-customer-jobs.md), [03](03-customer-pain.md), and [04 — Current Solutions](04-current-solutions.md).

## Tier 1 — Soon-to-be noncustomers

People currently using the industry's products but minimally, reluctantly, and ready to leave at the first better alternative.

- **Dissatisfied SaaS habit-tracker users.** Direct evidence: Habitica users citing crashes, pay-to-unlock frustration, and governance distrust ([03](03-customer-pain.md)); Way of Life users fighting persistent sync failures. These people already pay for or actively use a tracker — they are the easiest tier to convert, but also the tier every competitor in [05](05-competitor-map.md) is already fighting over, so winning them requires being clearly better on the specific pain that's pushing them out (trust, reliability), not just "also a tracker."
- **Stranded team-OKR SaaS buyers.** Microsoft Viva Goals customers, forced off their tool by the December 2024 discontinuation. FACT: they exist and had to migrate somewhere. [06 — Pressure Test](06-pressure-test.md) found they mostly moved SaaS-to-SaaS (Mooncamp, Perdoo, Quantive) rather than to self-hosting — meaning this tier's *default* path bypasses self-hosted options entirely, which is itself a targeting problem: reaching them requires intercepting the migration decision, not waiting for them to consider self-hosting on their own.

## Tier 2 — Refusing noncustomers

People who have consciously evaluated tracking tools (digital or analog) and rejected the category, not just a specific product.

- **The "do nothing" / rapid-abandonment segment**, evidenced at scale by the resolution-failure statistics in [04](04-current-solutions.md): ~80% fail resolutions by mid-February, "Quitters' Day" clustering around Jan 12-19, only ~9% keep resolutions all year. INSIGHT — this is very plausibly the *largest* segment by volume in the entire market map, larger than every SaaS and self-hosted product's combined user base. They reject tracking tools not because of price, privacy, or feature gaps — the tool isn't the bottleneck, sustained motivation is. No product identified in [05 — Competitor Map](05-competitor-map.md), including a hypothetical self-hosted one, currently addresses this; adding more tracking features doesn't convert this tier.
- **Committed analog trackers.** r/bulletjournal's 402,199 members ([04](04-current-solutions.md)) represent people who have tried digital tools and specifically chosen paper instead — a conscious rejection of the entire "app" framing, not an unmet-needs gap.
- **People who explicitly find gamification/streak mechanics counterproductive.** The "punishment of losing a 30-day streak is far greater than the reward of reaching 31" argument ([03](03-customer-pain.md)) describes a real rejection reason distinct from price or privacy — these people avoid the *category's dominant motivation mechanic*, not tracking as an idea.

## Tier 3 — Unexplored noncustomers

People in adjacent markets who have never considered a dedicated goal/habit tracker at all.

- **Notion/Sheets/Obsidian power-users building their own trackers inside general tools.** The Gumroad marketplace of habit-tracker templates and the 18 Obsidian habit-tracking plugins ([04](04-current-solutions.md)) show these people solve the problem entirely inside tools they already use for other purposes — they never evaluate and reject a dedicated tracker; it's simply never on their radar because their existing tool already does "enough."
- **Self-hosting hobbyists who host everything except a goal tracker.** r/selfhosted (~823K–839K members) and r/homelab (~1.1M members) are large, active, and growing ([01 — Market Map](01-market-map.md)), but their dominant topics are NAS, media servers, and networking — goal/habit tracking barely registers (confirmed directly in [06](06-pressure-test.md): a Lemmy "what do you use" thread drew only 7 replies, and quoted searches for "goal tracker" and "OKR" returned zero results on Lemmy.world). These are people who clearly value self-hosting as a general practice but have never extended that practice to this specific use case — the closest thing to true blue-ocean territory in this whole map, because the barrier isn't rejection, it's that the idea hasn't occurred to them.
- **Small teams who track goals informally in Slack/email/meetings and have never used any OKR software**, self-hosted or SaaS. Not directly evidenced in this research (a genuine gap — see [06](06-pressure-test.md) recommendation to study this segment directly), but implied by the general finding that per-seat OKR SaaS pricing puts a real cost floor under adoption for very small teams; below that floor, teams likely default to no formal tool at all rather than switching software.

## Strategic read

INSIGHT — Tier 3's self-hosting hobbyists are the most reachable *and* most under-served noncustomer group found in this research: they already have the server, the Docker familiarity, and the values (ownership, privacy) that make self-hosted goal tracking a natural fit — they simply haven't been offered a version of it that shows up where they already look (their homelab dashboard, their existing SSO, their existing notification pipeline). This directly motivates the "Create" items in [09 — ERRC Grid](09-errc-grid.md) around ecosystem integration, and it reframes the acquisition question: the job isn't convincing someone tracking is worth doing, it's showing an already-self-hosting audience that this is one more thing worth self-hosting. Tier 2's "do nothing" segment, despite being the largest by volume, is the hardest to convert with a tracking product at all — RECOMMENDATION: treat it as out of scope for this product idea rather than a target to chase, since converting it is a behavior-change problem, not a software-distribution problem.
