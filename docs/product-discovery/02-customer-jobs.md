# 02 — Customer Jobs: Self-Hosted Goal Tracking System

Jobs-to-be-Done people are hiring a goal/habit tracker for, with emphasis on the jobs specific to wanting it **self-hosted** rather than any SaaS equivalent. Evidence base: Hacker News Show HN threads/comments, self-hosted-tracker repo READMEs. **Reddit (r/selfhosted, r/getdisciplined) could not be reached this pass — see [00-index.md](00-index.md).** Ranking below is an INSIGHT drawn from how directly and how often each job surfaced in available sources, not a measured survey — treat rank order as a hypothesis to validate, not a fact.

## Ranked jobs

### 1. Own the data completely — no vendor, no account, no shutdown risk
**HIGH importance, HIGH frequency (recurring anxiety, not one-time).**
This is the job that makes "self-hosted" the differentiator rather than just another habit-tracker feature request.
- Direct quote (HN): *"I've been slowly moving everything to self hosted to reduce the pain if/when I'm ever randomly banned from Google."* ([HN #42526769](https://news.ycombinator.com/item?id=42526769))
- Direct quote (HN, framed as a product-strategy observation): *"The number of subscription saas apps that could be replaced by open source if there was a bring your own storage API would be astounding."* (same thread)
- Project positioning (mhabit README): *"Zero vendor lock-in and complete data privacy — your habit data always stays yours,"* no sign-up, no telemetry, sync via user-controlled servers. ([github.com/FriesI23/mhabit](https://github.com/FriesI23/mhabit))
- Corroborating market evidence: Microsoft discontinued Viva Goals (ex-Ally.io) in Dec 2024, orphaning enterprise OKR customers with no self-host escape hatch — a live example of exactly this fear materializing for a team-goal-tracking buyer (see [05 — Competitor Map](05-competitor-map.md)).

### 2. Don't let one missed day collapse the whole system
**HIGH importance, HIGH frequency (this is the core retention job of any habit tracker, self-hosted or not).**
- Direct quote (HN Show HN author): *"I kept failing at habit apps. I'd add 6 habits, miss a day, feel guilty, stop opening the app entirely."* His design response: *"one habit done beats ten habits planned."* ([HN #46767954](https://news.ycombinator.com/item?id=46767954))
This job is not specific to self-hosting — it's the baseline job any goal-tracking product must solve to retain users at all. INSIGHT: a self-hosted product still has to win on this job first; "self-hosted" is a reason to *choose* a tool among equals, not a substitute for solving the core retention problem.

### 3. Track my own way, not the workflow the app forces on me
**MEDIUM-HIGH importance, MEDIUM frequency.**
- Direct quote (HN, author of a custom tracker who rejected month-grid UIs standard in the category): *"I never enjoyed how most of them organize stuff by months since that doesn't fit with my philosophy."* ([HN #40720636](https://news.ycombinator.com/item?id=40720636))
- Self-hosting correlates with this job structurally: people who build/run their own instance are, by definition, people dissatisfied with being forced into someone else's opinionated workflow. Customizability (open API, configurable data model) is plausibly a stronger draw for this segment than for the SaaS-habit-tracker market generally.

### 4. Stop juggling a fragmented toolchain — get one system that holds the whole picture
**MEDIUM importance, MEDIUM frequency.**
- Direct quote (HN, on a self-hosted workout tracker, transferable to goal tracking generally): *"there isn't a single place where you can get both the holistic metrics _and_ the plan."* Reflects users running 7+ disconnected services. ([HN #39549194](https://news.ycombinator.com/item?id=39549194))
- Same thread, on why building your own beats depending on someone else's roadmap: *"The existential risk for indy devs is that your product is just a feature for [the incumbent]."*
- Corroborated indirectly by [04 — Current Solutions](04-current-solutions.md): the large cottage industry of Notion/Sheets/Obsidian goal-tracking templates is evidence people are already assembling their own patchwork systems inside general-purpose tools because no dedicated tool satisfies them.

### 5. See my own progress as a personal analytics/dashboard exercise
**LOW-MEDIUM importance, appears in a minority of sources but is distinctive.**
- Direct quote (self-hosted dashboard author): *"I personally find it useful to have a graphical overview of the things I'm working on, the progress I've made, my agenda for the upcoming days."* ([github.com/majorpeter/atomic-tracker](https://github.com/majorpeter/atomic-tracker))
This job sits one layer more introspective/analytical than plain streak tracking — closer to "personal data warehouse for my own life" than "keep me accountable." It's a natural extension for self-hosters who already value owning and querying their own data, but it's a smaller, more technical audience than jobs 1–4.

### 6. Recover from having over-engineered my own system
**LOW importance as a primary job, but notable as a churn/backlash signal.**
- Direct quote: *"burned out on metrics and complicated periodization programs to the point where I had almost stopped [the underlying activity]."* A commenter on the same thread echoed the pattern with other tools: elaborate systems become *"so complicated... that I never actually used"* the advanced features. ([HN #42526769](https://news.ycombinator.com/item?id=42526769))
INSIGHT: this is a second-order job — it shows up after someone has already tried a full-featured tool (self-hosted or SaaS) and reverted to wanting something simpler. Relevant as a design constraint (don't over-build the MVP), not as a primary acquisition hook.

## Gaps and confidence

- No jobs specific to **team/OKR self-hosting motivations** surfaced directly — all HN evidence is from individual/personal trackers. The team-buyer job set (compliance, procurement resistance to per-seat SaaS pricing, data residency) is currently an ASSUMPTION inferred from the competitive gap in [05 — Competitor Map](05-competitor-map.md), not from direct quotes of team buyers.
- No jobs related to **Home Assistant or Obsidian integration** were found with attached user rationale, despite searching — only a bare Obsidian plugin listing with no stated "why." Flagged as unconfirmed, not ruled out.
- Reddit is the most likely source for the richest self-hosting-specific JTBD language (r/selfhosted, r/getdisciplined) and was not reachable this pass. **RECOMMENDATION: before finalizing JTBD statements for a PRD, run a follow-up research pass with live Reddit access** to confirm or revise the ranking above.
