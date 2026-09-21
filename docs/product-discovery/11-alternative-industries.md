# 11 — Alternative Industries: Same Job, Different Category

Customers accomplish "make progress on something I care about and stay accountable to it" through products entirely outside the goal/habit-tracking software category. Each has a transferable value proposition worth stealing.

## Financial commitment-device industry (StickK, Beeminder)

- **StickK** — free to use; users optionally stake money ("commitment contracts") on a goal, with a referee verifying completion. FACT: StickK's own data shows users who stake money *and* have a referee succeed at 78%, vs. 35% for those with no money down. ([StickK FAQ](https://www.stickk.com/faq/financial/Commitment+Contracts))
- **Beeminder** — same mechanic, tighter integration with data feeds (including a Duolingo connector, per StickK's own comparison). ~15 years running, ~$983K estimated 2024 revenue ([06 — Pressure Test](06-pressure-test.md)).
- **Transferable value proposition:** money-on-the-line is a validated, quantified accountability mechanic — 78% vs. 35% success is a real, sourced effect size, not a marketing claim. No self-hosted product in [05 — Competitor Map](05-competitor-map.md) has attempted this mechanic; it requires payment infrastructure a self-hosted/open-source product would need to bolt on deliberately (e.g., an optional integration with a payment processor or an honor-system donation-to-charity-on-failure model), not something that falls out of self-hosting for free.

## Fitness/quantified-self industry (Strava, Oura, Duolingo)

- These products succeed on **passive, automatic tracking** rather than manual daily logging — the opposite of how every habit tracker in [04 — Current Solutions](04-current-solutions.md) works (you have to remember to open the app and check a box).
- Duolingo's streak mechanic is the most culturally dominant "don't break the chain" implementation in software, and it's the same mechanic [03 — Customer Pain](03-customer-pain.md) documents as anxiety-inducing when it fails (*"punishment of losing a 30-day streak is far greater than the reward"*) — evidence this mechanic is a double-edged transferable idea, not an unambiguous win to copy.
- **Transferable value proposition:** automatic, low-friction data capture (from existing self-hosted infrastructure a user already runs — see [13 — Complementary Products](13-complementary-products.md)) beats manual logging as a retention mechanism. This is a genuine gap: none of the self-hosted trackers in [05](05-competitor-map.md) integrate with any automatic data source.

## Personal knowledge management / note-taking industry (Obsidian, Logseq, Notion)

- FACT — 18 Obsidian plugins are tagged "habit-tracking" ([04 — Current Solutions](04-current-solutions.md)), and a maintained Logseq habit-tracker plugin exists. These tools' core value proposition — local-first or self-hostable, fully user-owned, infinitely flexible schema — is *closer* to the self-hosted goal-tracker value proposition than any dedicated competitor in [05](05-competitor-map.md) is.
- **Transferable value proposition:** "your data lives in a format and location you control, forever" is this industry's central pitch, more explicitly than most self-hosted habit trackers make it. A goal tracker borrowing PKM-tool conventions (plain files, Markdown export, no proprietary database lock-in) would be applying a lesson from an adjacent industry that out-executes the direct competitive set on the exact factor ([07 — Industry Factors](07-industry-factors.md)) ranked most important: trust/data ownership.

## Behavior-change / coaching industry (Coach.me, therapy/coaching apps)

- Coach.me pairs a free tracker with paid human coaching (~$25-87/week, per [04](04-current-solutions.md)) — evidence some people will pay significant money for *accountability from another person*, not software features.
- **Transferable value proposition:** human or social accountability layered on top of tracking software is a distinct, monetizable value-add. HabitSync's "shared challenges with leaderboards" ([05 — Competitor Map](05-competitor-map.md)) is the only self-hosted competitor attempting a version of this; it's thin compared to Coach.me's dedicated coaching-marketplace model.

## Open-source infrastructure/dev-tool industry (Vaultwarden, Immich, Plausible)

- Already documented in [06 — Pressure Test](06-pressure-test.md) as the monetization benchmark: these succeed via hard security/utility lock-in (password vaults, photo libraries) or genuine SaaS switching-cost value (analytics with historical data).
- **Transferable value proposition:** the *distribution mechanism* — one-click deploy via Railway/Coolify/PikaPods/Unraid-style app stores — is directly transferable and already validated by Operately's use of exactly this pattern ([06](06-pressure-test.md)). The *monetization mechanism* (paid lifetime license post-professionalization, like Immich) is transferable in principle but requires the scale Immich had (114K+ stars) before it worked — not yet applicable at this category's current size.

## Synthesis

INSIGHT — the single most transferable, underused idea across all five alternative industries is **combining PKM-tool-grade data ownership (own your files, no lock-in) with fitness-industry-grade passive/automatic data capture**, wrapped in the open-source-infra industry's one-click distribution model. No competitor identified in [05 — Competitor Map](05-competitor-map.md) combines even two of these three; each is copied from a different industry that already validated it independently. This is a candidate value innovation for [09 — ERRC Grid](09-errc-grid.md)'s Create column — not proven demand, but a values-innovation-shaped opportunity a within-category competitor analysis alone would never surface.
