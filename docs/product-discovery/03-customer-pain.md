# 03 — Customer Pain: Self-Hosted Goal Tracking System

Frustrations, unmet needs, and costly problems with existing goal/habit-tracking tools (SaaS and self-hosted), ranked by severity. Severity here means how strongly and how directly users expressed the complaint in primary sources (app-store reviews, HN, repo status), not a measured survey. **Reddit could not be reached this pass — see [00-index.md](00-index.md).**

## Ranked pains

### 1. Distrust of the vendor — governance failures, abrupt product changes, orphaned buyers
**SEVERE.** This is the pain that most directly motivates the "self-hosted" solution category, not just a feature complaint.
- Habitica: reported the developers *"fired their moderation team with no preparation, alienated all volunteers,"* with dissenters *"muted or banned."* ([Trustpilot](https://www.trustpilot.com/review/habitica.com))
- Habitica support failure: a gem-purchase bug took *"two whole days for them to say 'we are working on a fix', no timeline."* ([JustUseApp aggregated reviews](https://justuseapp.com/en/app/994882113/habitica-gamified-taskmanager/reviews))
- Microsoft discontinued Viva Goals (ex-Ally.io) in Dec 2024 with no on-prem migration path for enterprise OKR customers — FACT, the starkest available evidence of vendor-risk pain at the team/business tier ([05 — Competitor Map](05-competitor-map.md)).
- HN, directly connecting this pain to the self-hosted solution: *"I've been slowly moving everything to self hosted to reduce the pain if/when I'm ever randomly banned from Google."* ([HN #42526769](https://news.ycombinator.com/item?id=42526769))

### 2. Subscription pricing resentment, especially for a low-complexity product
**HIGH.**
- Strides: *"The subscription fee is insane!"* and *"I don't agree with justification for a subscription model"* for a ~$30/year habit tracker; free tier capped at 3 habits. ([JustUseApp](https://justuseapp.com/en/app/672401817/strides-habit-tracker-goals/reviews))
- INSIGHT: the complaint pattern isn't "I can't afford it," it's "this app is simple enough that a subscription feels unjustified" — a values/fairness objection as much as a price objection. That framing matters for positioning a free/self-hosted alternative: the pitch isn't "cheaper," it's "this shouldn't cost anything recurring."
- Corroborating signal: Way of Life users explicitly praise the *absence* of a subscription (buy-once model) as a differentiator — non-subscription pricing is a real driver of preference, not just an assumption (medium confidence — paraphrased from review synthesis, not independently re-verified via direct quote).

### 3. Pay-to-unlock mechanics and confusing in-app currency
**MEDIUM-HIGH**, specific to gamified trackers (Habitica).
- *"Having to buy game currency is one of my biggest pet peeves. You can't convert gold to gems"*; *"don't get Habitica if you actually want to unlock everything."* ([JustUseApp](https://justuseapp.com/en/app/994882113/habitica-gamified-taskmanager/reviews))
- Reliability complaint compounding this: *"The latest 2 versions of Habitica have ceased to work at all for me. They crash on startup."*

### 4. Sync failures and cross-device unreliability
**MEDIUM.**
- Way of Life: *"tried everything to sync across devices, but it never works."* (medium confidence — paraphrased, not independently re-verified)
- INSIGHT: sync is a recurring failure point across trackers generally, and is exactly the kind of problem self-hosting can either solve (you control your own sync backend) or make worse (you're now responsible for running that backend reliably yourself). This is a double-edged design risk, not a clean argument for self-hosting.

### 5. Gamification/streak anxiety — the cure becomes the disease
**MEDIUM, but lower-confidence.**
- Secondary/analysis source (not a raw user complaint): *"the punishment of losing a 30-day streak is far greater than the reward of reaching 31."* ([softdev23.com](https://softdev23.com/why-standard-habit-trackers-fail/)) — flagged as an inference/blog argument, not verified against actual user comments this pass.
- Directionally supported by job #2 in [02 — Customer Jobs](02-customer-jobs.md): an HN Show HN author built a tool specifically because *"I'd add 6 habits, miss a day, feel guilty, stop opening the app entirely."* That's the churn mechanism this pain point predicts, from a primary source.

### 6. Self-hosted alternatives carry their own abandonment risk
**MEDIUM — an important, somewhat ironic finding.**
- A GitHub-listed self-hosted goal/habit/dashboard project is explicitly tagged **[UNMAINTAINED]**. ([github.com/topics/habit-tracking?l=python](https://github.com/topics/habit-tracking?l=python))
- okr2go, a self-hosted OKR tool, is archived/abandoned (last push 2023). ([04 — Current Solutions](04-current-solutions.md))
- INSIGHT: self-hosting solves the *corporate* vendor-risk problem (job #1 above) but does not automatically solve the *maintenance* risk problem — a solo-maintainer open-source project can vanish just as suddenly as a company pivots. Any product entering this space needs a credible answer to "why will you still be maintaining this in 3 years" as part of its trust pitch, not just "it's open source."

### 7. Complexity/over-engineering fatigue
**LOW-MEDIUM**, but a real second-order churn driver once users have tried a full-featured tool.
- *"burned out on metrics and complicated periodization programs to the point where I had almost stopped [the tracked activity]."* Echoed by a commenter: elaborate systems become *"so complicated... that I never actually used"* the advanced features. ([HN #42526769](https://news.ycombinator.com/item?id=42526769))

## Gaps and confidence

- No app-store review mining was done for Beeminder, Coach.me, or Streaks specifically (only Strides, Habitica, Way of Life were pulled with direct quotes) — those three are ASSUMED to have broadly similar pricing/reliability complaint patterns but this is unverified.
- No GitHub issue-tracker mining was completed on uhabits or Habitica's open-source repos to find recurring feature-request patterns — flagged in the underlying research as a good follow-up, not done this pass.
- The severest pain (#1, vendor distrust) is also the pain a self-hosted product is best positioned to solve — but pain #6 (self-hosted maintenance abandonment) is a direct threat to that same pitch's credibility. **RECOMMENDATION:** any positioning built on "self-hosted = trustworthy" needs to pair with a concrete sustainability story (funding model, maintenance commitment, or a very simple/low-maintenance-surface architecture), not just the license.
