# 12 — Strategic Groups: Self-Hosted Goal Tracking System

Grouping the competitors from [05 — Competitor Map](05-competitor-map.md) by price, quality/polish, complexity, convenience, and customer segment, to find the gaps between groups per Blue Ocean strategy.

## Group A — Gamified consumer SaaS (individual)

**Members:** Habitica, and to a lesser extent Strides.
**Price:** free-to-low ($0-5/mo). **Quality/polish:** moderate (Habitica has real reliability complaints). **Complexity:** high relative to the job (RPG systems, in-game currency). **Convenience:** very high (nothing to install). **Segment:** consumer individuals who want extrinsic motivation/fun layered on tracking.

## Group B — Minimalist consumer SaaS (individual)

**Members:** Streaks, Way of Life.
**Price:** low, one-time-lean where possible. **Quality/polish:** high within a narrow feature set. **Complexity:** low. **Convenience:** very high. **Segment:** consumers who want simplicity and dislike gamification, often platform-locked (iOS-heavy).

## Group C — Commitment-device SaaS (individual)

**Members:** Beeminder, StickK.
**Price:** free-to-use with optional/mandatory financial stakes. **Quality/polish:** high (Beeminder: 15 years of continuous operation). **Complexity:** medium (data-feed integrations, pledge mechanics). **Convenience:** high. **Segment:** a self-selected niche willing to risk real money against goal failure — proven small (~$1M/year for Beeminder after 15 years) but durable.

## Group D — Enterprise/SMB OKR SaaS (team)

**Members:** Weekdone, Perdoo, Quantive, the discontinued Microsoft Viva Goals.
**Price:** per-seat, $7-12+/user/month typically. **Quality/polish:** high, enterprise-grade reporting and integrations. **Complexity:** high (cascading OKRs, alignment scoring, admin controls). **Convenience:** very high (fully managed). **Segment:** businesses from small teams to large enterprises, sold as a formal performance-management category, not an individual productivity tool.

## Group E — Self-hosted individual OSS

**Members:** BeaverHabits, HabitSync, OpenHabitTracker, uhabits/Loop (local-only, borderline member).
**Price:** free. **Quality/polish:** variable, generally modest (small teams, some unmaintained). **Complexity:** low-to-medium. **Convenience:** low (Docker/self-hosting knowledge required, no one-click ecosystem found for this specific sub-category). **Segment:** technical individuals already running a home server, motivated by ownership/privacy over polish.

## Group F — Self-hosted team OSS / open-core

**Members:** Operately (mature), Open OKR / BurningOKR / okr_os (immature).
**Price:** free self-hosted, flat-rate paid cloud (Operately: $0-249/mo regardless of seat count). **Quality/polish:** Operately is genuinely polished and actively maintained (559 stars, daily commits); the rest are pre-production. **Complexity:** medium. **Convenience:** medium-high for Operately specifically (one-click Railway deploy), low for the rest. **Segment:** small-to-mid teams (5-100, per Operately's own positioning) wanting OKR software without per-seat pricing or vendor lock-in.

## Gap analysis

| Gap | Between groups | Why it's open |
|---|---|---|
| **Consumer-grade convenience + self-hosted ownership, individual segment** | Between B/A (high convenience) and E (high ownership, low convenience) | No individual self-hosted tracker found in [05](05-competitor-map.md) has closed this gap the way Operately closed it for teams — there is no "Operately for personal habits." |
| **Commitment-device mechanic + self-hosting** | Between C (Beeminder/StickK) and E/F (self-hosted) | Nobody has combined a financial-stakes mechanic with a self-hosted deployment — likely because payment processing sits awkwardly with a self-hosted architecture, but that's an implementation obstacle, not a proof it's undesirable. |
| **Sub-5-person team OKR tooling below Operately's stated 5-100 sweet spot** | Below Group F | Not directly evidenced, but implied: if per-seat SaaS (Group D) puts a cost floor under very small teams and Operately targets 5+, a 1-4 person team (a founder plus a couple of early hires) may be underserved by every group. Flagged as ASSUMPTION requiring direct validation, consistent with the segment-research gap noted in [06 — Pressure Test](06-pressure-test.md). |
| **Passive/automatic data capture, any segment** | Cuts across all six groups | As noted in [11 — Alternative Industries](11-alternative-industries.md), every group here still relies on manual logging; none imports data automatically the way Strava/Oura do. |

## Strategic read

INSIGHT — Operately's position (Group F) is structurally the most interesting in this whole map because it's the only group member that has pulled off the same "raise convenience without sacrificing ownership" move Group B and Group E each only do half of. The two clearest, most defensible white-space candidates are (1) replicating Operately's move for the *individual* habit-tracking segment (nobody has done for Group E what Operately did for Group F), and (2) serving the very-small-team segment Operately itself doesn't target. Both are narrower, more falsifiable bets than the original "self-hosted goal tracker" framing — consistent with [09 — ERRC Grid](09-errc-grid.md)'s push toward a specific value curve rather than a generic build.
