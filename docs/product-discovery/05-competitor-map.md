# 05 — Competitor Map: Self-Hosted Goal Tracking System

## Direct competitors — genuinely self-hostable AND goal/habit-specific

This is a short list. All are small, community-run projects; none has SaaS-incumbent-level polish or documentation.

| Product | Target customer | Value prop | Pricing/license | Key features | Weaknesses |
|---|---|---|---|---|---|
| **[HabitSync](https://github.com/jofoerster/habitsync)** | Individuals/friend groups | "Self-hosted habit tracker featuring goals and challenges with friends" | Free, BSD-3-Clause, Docker/Docker Compose, H2 or PostgreSQL | Flexible habit intervals, goal tracking incl. negative habits, shared challenges w/ leaderboards, OIDC/SSO, Apprise notifications (80+ services), Android app + PWA, Loop importer | API "incomplete, subject to change"; recent breaking OIDC change (v0.19.0); unconfirmed production maturity |
| **[BeaverHabits](https://github.com/daya0576/beaverhabits)** | Individuals | Self-hosted habit tracker "without Goals" — deliberately simple, streak-focused | Free, BSD-3-Clause, ~1.8K stars | Docker/Unraid/Easypanel deploy, SQLite or JSON storage, optional authless mode, API access | Deliberately skips goal-setting frameworks (by design); NiceGUI web UI, not a native app |
| **[OpenHabitTracker](https://openhabittracker.net/)** | Privacy-focused individuals | No ads/accounts/subscriptions, open source | Free; hybrid — local-first PWA/native apps, optional Docker self-host for server-side sync | Interval-based (not pure-streak) urgency model, Markdown notes, task planning, 26 themes, 20 languages, cross-platform | Self-hosted sync mode's maturity vs. local-only mode is unconfirmed |
| **[MyDailies](https://github.com/FR0ST1N/MyDailies)** | Individuals | Simple self-hosted habit app | Free, Docker deploy | Limited documented features | Stalled (last push Nov 2024) |
| **[Habo](https://github.com/xpavle00/Habo)** | Individuals | E2EE-synced habit tracker | Free, Flutter (iOS/Android) | Self-hostable sync backend claimed | Feature/pricing detail beyond tagline unconfirmed |
| **[atomic-tracker](https://github.com/majorpeter/atomic-tracker)** | Individuals (technical) | Self-hosted personal progress dashboard | Free | Dashboard-style overview, optional external data integrations | Details beyond repo description unconfirmed |

**Not counted as a direct competitor despite being the most-cited "open source habit tracker":** [Loop Habit Tracker (uhabits)](https://loophabits.org/) — Android-only, GPLv3, fully local/offline, no server or sync component. Fails the self-hosting criterion outright.

## Goal-specific but team/OKR-oriented, self-hostable

| Product | Target customer | Value prop | License/deploy | Status |
|---|---|---|---|---|
| **[Open OKR](https://github.com/open-okr/open-okr)** | Teams/enterprises | "Set goals, plan the work that moves them, track both in one place — self-hosted or in the cloud, AI-native" | AGPL-3.0, Docker Compose or K8s/Helm, Postgres-only, air-gap capable | **2 GitHub stars, 0 forks, Phase 1 of 8 — not production-ready** |
| **OpenOKR** ([github.com/openokr/openokr](https://github.com/openokr/openokr)) | Teams | Unconfirmed beyond repo description | — | Maturity unconfirmed |
| **okr_os** ([github.com/credifit-br/okr_os](https://github.com/credifit-br/okr_os)) | Teams | Unconfirmed beyond repo description | — | Maturity unconfirmed |
| **[okr2go](https://github.com/oxisto/okr2go)** | Teams | Self-hosted OKR tracker | — | **Archived/abandoned**, last push 2023-04 |
| Habitica (community self-host) | Individuals | Run your own Habitica instance | Docker image ([awinterstein/habitica-server](https://hub.docker.com/r/awinterstein/habitica-server)), Mongo + Node + Vue | **Community-maintained, not officially supported by the vendor** |

## SaaS benchmark — individual habit/goal trackers (what a self-hosted product is compared against)

| Product | Pricing | Notes |
|---|---|---|
| Habitica | Free core; Plus $4.99/mo–$47.99/yr | Gamified, social guilds/parties. See [03 — Customer Pain](03-customer-pain.md) for complaint detail. |
| Beeminder | Free Core; $8/$16/$81/mo + penalty pledges | Commitment-device model — unique in charging you for failure. |
| Strides (iOS only) | Free (3 trackers); $4.99/mo–$79.99 lifetime | No Android/web/desktop. |
| Way of Life | Free (3 habits); $4.99/mo–$29.99 | iOS + Android. |
| Streaks (Apple only) | $1.99/mo or $19.99/yr (was one-time $5.99) | Up to 24 habits, Apple Watch, iOS/Mac only. |
| Coach.me | Free tracker; ~$87/mo human coaching add-on | Coaching marketplace, not just software. |

## SaaS benchmark — team/enterprise OKR platforms

| Product | Pricing | Self-hosted/on-prem? |
|---|---|---|
| Weekdone | Free ≤3 users; $108–$2,025/mo scaling by seats | **No** |
| Quantive (ex-Gtmhub) | From $9/user/mo | **No**; acquired by WorkBoard 2025, consolidation ongoing — vendor-risk signal in progress |
| Perdoo | Free ≤5 users; $9–11/user/mo | **No** |
| Microsoft Viva Goals (ex-Ally.io) | Was ~$108/tier | **No** — and **discontinued Dec 2024**, the clearest cautionary tale in this whole map |

**FACT, confirmed across all four:** none of the major SaaS OKR platforms publicly offers self-hosted/on-prem deployment. This is the clearest, most defensible gap found in this entire research pass.

## Adjacent self-hosted productivity suites (generic PM tools, not goal/habit-specific — indirect competitors for attention/budget)

| Product | License/pricing | Notes |
|---|---|---|
| [Vikunja](https://vikunja.io/pricing/) | AGPLv3, free self-host; Pro features license-gated even self-hosted; Cloud from €4/mo | Task/project manager, no habit or OKR features |
| [Focalboard](https://github.com/mattermost-community/focalboard) | MIT/AGPLv3, free | Trello/Notion/Asana-style boards, no goal layer |
| [Leantime](https://leantime.io/) | AGPLv3 CE free; Cloud from $4–10/user/mo | Neurodivergent-friendly PM positioning; no dedicated habit/goal module confirmed |
| [OpenProject](https://www.openproject.org/pricing/) | CE free unlimited users; Enterprise on-prem from ~€5.95/user/mo | General PM; OKR module presence unconfirmed |
| [Plane](https://plane.so/self-hosted) | AGPLv3 CE free self-host; Pro $6/seat/mo, Business $13/seat/mo cloud | Jira/Linear-style issue tracker. **Self-hosting reported as painful** — GitHub issue #8708 "VERY BAD SELF HOSTING EXPERIENCE," complaints about 7+ containers, ~200 env vars, broken version upgrades. Cautionary example for our own deploy-complexity design. |
| [Huly](https://github.com/hcengineering/huly-selfhost) | EPL-2.0, free self-host (needs CockroachDB/Elasticsearch/Redpanda/MinIO — heavy stack); cloud $0–$399.99/mo by storage | Linear/Notion-style all-in-one, no goal/habit features |

## Strategic read

1. **The gap is real and confirmed twice over**: no SaaS OKR vendor self-hosts, and the open-source self-hosted OKR alternatives are either pre-production (2 stars) or abandoned (archived 2023). If there's a wedge in this whole market, it's team/OKR self-hosting, not individual habit tracking — individual habit tracking already has a moderately healthy open-source scene (BeaverHabits, HabitSync, OpenHabitTracker).
2. **But the gap being empty doesn't mean it's wanted.** No evidence was found of team buyers actively asking for self-hosted OKR tooling (see the gaps flagged in [02 — Customer Jobs](02-customer-jobs.md)) — the Viva Goals discontinuation is a vendor-risk *event* that happened to buyers, not confirmed proof those buyers then went looking for a self-hosted alternative rather than just switching to another SaaS competitor.
3. **Deployment complexity is a live differentiator risk.** Plane's self-hosting backlash (7+ containers, ~200 env vars) shows that "self-hostable" alone isn't a selling point if the install experience is bad — this is a design constraint, not just a market observation.
4. **Individual habit tracking is the more crowded, better-proven-demand lane; team OKR self-hosting is the emptier, riskier, unproven-demand lane.** This tension — proven-but-crowded vs. empty-but-unproven — is the central strategic choice to resolve before moving past discovery. It is not resolved by this document; it requires direct validation with prospective team buyers, which is out of scope for a market/competitor mapping pass.
