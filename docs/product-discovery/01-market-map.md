# 01 — Market Map: Self-Hosted Goal Tracking System

## Segments

The market splits along two independent axes: **who** is tracking (individual vs. team/business) and **why self-hosted** (vs. any SaaS alternative). Four segments emerge:

| Segment | Description | Evidence |
|---|---|---|
| **Individual self-hosters** | Privacy/ownership-motivated hobbyists already running a home server (NAS, Docker, Proxmox) for other apps, extending it to personal habit/goal tracking | FACT — r/selfhosted ~823K–839K members, r/homelab ~1.1M members with ~227K joined in the past year ([gummysearch r/selfhosted](https://gummysearch.com/r/selfhosted/), [gummysearch r/homelab](https://gummysearch.com/r/homelab/)) |
| **Privacy/data-sovereignty individuals** | Broader than homelab hobbyists — people avoiding SaaS for GDPR/AI-training-data/subscription-fatigue reasons, may not self-host anything else yet | FACT (qualitative) — 2026 trend pieces cite AI-training-data concern and subscription fatigue as emerging self-hosting motivators ([Dreamhost](https://www.dreamhost.com/blog/self-hosting/)) |
| **Small teams / businesses avoiding SaaS lock-in** | Teams wanting OKR/goal tracking without vendor risk, data residency requirements, or per-seat SaaS pricing at scale | INSIGHT — no mainstream OKR SaaS (Weekdone, Quantive, Perdoo, Viva Goals) offers self-hosting; Microsoft discontinued Viva Goals (ex-Ally.io) in Dec 2024, stranding on-prem-averse enterprise buyers — a cautionary tale this segment is already alert to |
| **Open-source/dev-tool enthusiasts** | People who star, fork, and self-build trackers as much for the engineering exercise as the end use | FACT — multiple Show HN posts are personal projects built by developers scratching their own itch (see [02 — Customer Jobs](02-customer-jobs.md)) |

Personal (habit/resolution) and team (OKR/KPI) tracking are **functionally different products** — different data models (streaks vs. objectives/key-results), different buyers, different competitive sets. Any market-sizing or roadmap decision needs to pick a lane rather than treat "goal tracking" as one market.

## Products in the space (adjacent self-hosted ecosystem)

GitHub star counts as of 2026-09-18 (FACT, pulled live via GitHub API):

| Project | Stars | Category |
|---|---|---|
| Plane | 59,591 | General project/task management |
| Focalboard | 26,470 | Kanban/project boards |
| OpenProject | 16,146 | General project management |
| Leantime | 11,606 | Project management (neurodivergent-friendly positioning) |
| Loop Habit Tracker (uhabits) | 10,256 | Habit tracker — **local-only, not server/self-hosted** |
| Vikunja | 5,451 | Task management |
| BeaverHabits | 1,837 | Self-hosted habit tracker |
| Habo | 1,507 | Habit tracker (E2EE sync) |
| HabitTrove | 681 | Self-hosted habit tracker |
| OpenHabitTracker | 283 | Habit tracker (hybrid local/self-host) |
| MyDailies | 16 | Self-hosted habit tracker |
| Open OKR | 2 | Self-hosted OKR (pre-production) |

INSIGHT — habit-tracker star counts top out an order of magnitude below general project-management tools (10K vs. 60K). GitHub stars measure developer attention, not end-user adoption, so this is a weak demand proxy — but it is consistent with goal/habit tracking being a narrower, less-invested-in niche than general PM tooling within the self-hosted world.

For discoverability context: Awesome-Selfhosted, the flagship curated list and de facto entry point for this whole market, has 320,103 stars — FACT, evidence the self-hosting *discovery* audience is large even though any single goal-tracking app's following is small ([github.com/awesome-selfhosted/awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted)). There is no dedicated "goal tracking" or "OKR" category on that list; entries are scattered under general productivity/time-tracking tags — INSIGHT, self-hosted goal tracking is not yet a recognized category with its own demand cluster, it's a sub-niche.

## Business models observed in this space

| Model | Description | Example | Source |
|---|---|---|---|
| Open-core | Free self-hosted core + proprietary paid add-ons or hosted tier | GitLab, Elastic, MongoDB | FACT — [Wikipedia: Open-core model](https://en.wikipedia.org/wiki/Open-core_model) |
| Dual licensing | AGPL/GPL for community, commercial license for companies unwilling to comply with copyleft | MySQL, Qt, MongoDB (SSPL), Elastic (SSPL) | FACT — same source set |
| Self-hosted + hosted-cloud tier | Free/cheap self-host, paid managed-cloud version for recurring revenue | GitLab CE/EE + SaaS | FACT — [Schmalbach, OSS business models](https://www.vincentschmalbach.com/open-source-business-models/) |
| License-key-gated features even when self-hosted | AGPL core is free to self-host, but specific features require a paid license key regardless of deployment | Vikunja Pro features (time tracking, audit logs) | FACT — [vikunja.io/pricing](https://vikunja.io/pricing/) |
| Donations/sponsorware | No confirmed example found in this specific niche | — | NOT VERIFIED |

RECOMMENDATION for future pricing work: the open-core-with-hosted-tier pattern (free self-host, paid managed cloud) is the most-precedented model among comparable self-hosted productivity tools and is worth treating as the default hypothesis to test, not a from-scratch pricing exercise.

## Market size signals

Caution: none of the figures below are specific to self-hosted goal/habit tracking. They are adjacent-category estimates, cited with their limitations.

- FACT, wide variance across analysts — OKR software (SaaS) market estimated at $1.84B in 2026 (16.5% CAGR from $1.58B in 2025) by one firm ([Research and Markets](https://www.researchandmarkets.com/reports/5970972/objectives-key-results-okr-software-market)), vs. $1.36B rising to $3.05B by 2035 (9.39% CAGR) by another ([360 Research Reports](https://www.360researchreports.com/market-reports/okr-software-market-212602)). Neither breaks out self-hosted/on-prem share.
- FACT, low confidence (secondary summary only, primary report not independently fetched) — broader "personal productivity apps" market estimated at $14.46B (2026) growing to $30.85B (2034), ~9.94% CAGR, "personal" segment ~40% of that.
- FACT, single-source, methodology unverified — broader "self-hosting market" (all infrastructure/software, not goal-tracking specific) projected at $85.2B by 2034, 18.5% CAGR ([Market.us via WebProNews](https://www.webpronews.com/self-hosting-surges-in-2026-market-to-reach-85-2b-by-2034/)).

INSIGHT — there is no usable top-down market-size number for this specific product category. Any sizing exercise for a self-hosted goal tracker needs to be built bottom-up from the self-hosting community size (r/selfhosted + r/homelab ≈ 1.9M combined, with heavy overlap likely) and an estimated attach rate, not borrowed from the OKR-SaaS or productivity-app markets, which serve a much broader and differently-motivated buyer.

## Trends

- FACT (secondary citation of Gartner, not verified at primary source) — "more than 75% of enterprises will have a digital sovereignty strategy by 2030," cited in [ngteco.com](https://ngteco.com/blogs/workforce-insights/data-sovereignty-trends-2026).
- FACT (qualitative, multiple sources) — AI-training-data anxiety is a newly-cited 2026 motivator for self-hosting, layered on top of the older privacy/cost drivers ([Dreamhost](https://www.dreamhost.com/blog/self-hosting/)).
- INSIGHT — r/selfhosted and r/homelab are both large and still growing (per source above), so the *distribution* layer for a self-hosted goal tracker to launch into already exists and is healthy. This does not by itself establish demand for goal-tracking specifically within that community — the dominant homelab topics are NAS, media servers, and networking, and no direct survey data ranking "goal/habit tracking" as a wanted app category was found. This is the single most important open question before committing further: **is there a demand signal inside the self-hosting community specifically for this category, or only a general appetite for self-hosting anything?** That requires primary research this pass could not reach (see [00-index.md](00-index.md) Reddit-access gap).
