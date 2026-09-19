# 04 — Current Solutions: How People Track Goals Today

Full spectrum from direct products to doing nothing at all. Everything below is sourced; items with thin evidence are flagged.

## 1. Direct SaaS products

| Product | Pricing | Notes |
|---|---|---|
| Habitica | Free core; Habitica Plus $4.99/mo–$47.99/yr (cosmetics) | Gamified RPG-style. See pain points in [03](03-customer-pain.md). |
| Streaks (iOS only) | Historically one-time $5.99; newer version $1.99/mo or $19.99/yr | Apple Design Award winner, 4.8★, no Android/web. |
| Strides | Free (3 trackers); $4.99/mo–$79.99 lifetime | Subscription resentment, see [03](03-customer-pain.md). |
| Way of Life | Free (3 habits); ~$4.99/mo–$29.99 one-time (varies) | Users value non-subscription option; sync complaints. |
| Beeminder | Free (3 goals); $8/$16/$81/mo tiers + escalating financial penalties ($5→$2,430) for missed goals | Distinct "commitment device" model — nobody else charges you for failing. |
| Coach.me | Free tracker; human coaching add-on from $25–87/wk | Coaching marketplace as much as software. |
| Goalscape | Unconfirmed pricing/usage — only a passing AlternativeTo mention found | Flagged as weakly verified. |
| Notion (via templates) | Free tool, $7+ paid templates on Gumroad | Not a dedicated product — a large cottage industry of goal/habit templates built on a general workspace tool. Strong evidence of organic repurposing. |

Team/OKR SaaS (different buyer, included for context):

| Product | Pricing | Self-host? |
|---|---|---|
| Weekdone | Free ≤3 users; $108–$2,025/mo scaling by seats | No |
| Quantive (ex-Gtmhub) | From $9/user/mo | No; acquired by WorkBoard 2025, consolidation ongoing |
| Perdoo | Free ≤5 users; $9–11/user/mo | No |
| Microsoft Viva Goals (ex-Ally.io) | Was ~$108/tier | **Discontinued Dec 2024** — no self-host escape hatch |

## 2. Direct self-hosted / open-source options

GitHub-verified (stars, last push, as of 2026-09-18):

| Repo | Stars | Last push | Status |
|---|---|---|---|
| iSoron/uhabits (Loop Habit Tracker) | 10,256 | 2026-07-21 | Active, largest by far — **but local-only, no server/sync, not truly self-hosted** |
| daya0576/beaverhabits | 1,837 | 2026-09-17 | Very active, genuinely self-hostable |
| xpavle00/Habo | 1,507 | 2026-06-15 | Active |
| dohsimpson/HabitTrove | 681 | 2026-03-07 | Active-ish |
| Jinjinov/OpenHabitTracker | 283 | — | Active, hybrid local/self-host |
| jofoerster/habitsync | (small) | recent | Active — see [05](05-competitor-map.md) for feature detail |
| FR0ST1N/MyDailies | 16 | 2024-11-24 | Stalled |
| open-okr/open-okr | 2 | 2026-09-18 | Brand new, unproven, pre-production |
| oxisto/okr2go | 55 | 2023-04-09 | **Archived/abandoned** |
| oslokommune/okr-tracker | — | — | Municipal project, Firebase-dependent — not really self-hostable |

INSIGHT — self-hosted **habit** trackers are a real, active category. Self-hosted **OKR** tools are thin and immature; nothing found has meaningful traction. This is the same whitespace signal as [05 — Competitor Map](05-competitor-map.md).

## 3. Indirect / adjacent tools people repurpose

- **Spreadsheets** — a large Gumroad marketplace of Google Sheets habit-tracker templates (dozens of sellers, some with 449+ downloads and ratings). Strong evidence of real, ongoing demand for spreadsheet-based tracking. ([example](https://reduxsoul.gumroad.com/l/habit2blue))
- **Obsidian** — 18 plugins tagged "habit-tracking" on ObsidianStats, including Habit Tracker 21 and "Habits" (streaks/charts/PDF export). An active plugin ecosystem, not one hobby project. ([obsidianstats.com](https://www.obsidianstats.com/tags/habit-tracking))
- **Logseq** — c6p/logseq-habit-tracker exists as a maintained plugin.
- **Notion** — cottage industry of paid/free templates (see above).
- **Trello** — anecdotal only; a couple of blog mentions of repurposing Kanban boards for goals, no strong usage data. Flagged as under-verified.
- **Day One, Apple Reminders/Notes, Trilium/Joplin repurposing** — not found with direct evidence this pass; flagged unconfirmed, not ruled out.

## 4. Manual / analog workarounds

- **r/bulletjournal**: 402,199 members, active since 2014 — solid evidence analog bullet journaling persists at scale alongside every digital option. ([reddapi.dev](https://reddapi.dev/subreddits/bulletjournal/insights))
- **Printable habit-tracker PDFs**: a real commercial micro-market on Gumroad alongside the spreadsheet templates — ongoing demand for paper/PDF trackers, not a legacy behavior in decline.
- **"Don't break the chain" wall calendars**: widely cited in secondary sources but not independently re-verified with fresh, dated evidence this pass. Flagged as commonly cited, not confirmed current.

## 5. "Do nothing" — no systematic tracking at all

Strong, multi-sourced statistics on resolution/goal abandonment (aggregator/blog citations of underlying studies — directionally reliable, exact percentages not independently re-verified at primary source):

- ~80% fail resolutions by mid-February, across multiple behavioral studies.
- A Strava-linked analysis of 800M logged activities popularized "Quitters' Day" (~Jan 12–19) as when most resolutions are abandoned. ([Inc.com](https://www.inc.com/jeff-haden/a-study-of-800-million-activities-predicts-most-new-years-resolutions-will-be-abandoned-on-january-19-how-you-cancreate-new-habits-that-actually-stick.html))
- Only ~8–10% report ultimately achieving their goal; ~70% of Americans who set a 2024 resolution had abandoned it by year-end; only ~9% keep resolutions all year. ([worldmetrics.org](https://worldmetrics.org/new-year-resolution-statistics/), [ehm-tech.com](https://www.ehm-tech.com/habit/blog/new-year-resolution-statistics/))

INSIGHT — "do nothing" (or abandon quickly) is very plausibly the largest segment by volume. This is the true Blue-Ocean-relevant noncustomer group: people who don't adopt *any* tracking tool, digital or analog, because the tools themselves aren't the bottleneck — sustained motivation is. No tracker, self-hosted or otherwise, converts this group by adding more tracking features; it would require addressing the motivation/behavior-change problem directly, which is a different (and much harder) product bet than "build a better tracker."

## Overall read

The competitive reality spans well-funded SaaS, an active-but-fragmented self-hosted habit-tracker scene (strong on habits, weak on OKRs), a large adjacent ecosystem of repurposed general tools, a persistently large analog/paper community, and a very large "does nothing systematic" segment. The clearest gap is self-hosted OKR/team-goal tooling — but the clearest **volume opportunity**, if it's reachable at all, is the "do nothing" segment, which no product in this space (including a hypothetical new self-hosted one) currently addresses.
