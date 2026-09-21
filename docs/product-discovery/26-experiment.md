# 26 — 30-Day Experiment: Quantified Team

A 30-day validation plan for the [22 — Winner](22-winner.md) concept, run largely at the Stage 0 concierge-MVP level defined in [25 — MVP](25-mvp.md), because the core pain assumption is unconfirmed and building software to test an unconfirmed pain would be premature per PM principle 16.

## Objective

Answer four questions, each tied to a specific gap flagged elsewhere in this research: is the core pain real ([19 — Strategic Fit](19-strategic-fit.md) flagged it as unquoted), will a team redirect existing OKR-tool budget to this ([21 — Willingness to Pay](21-willingness-to-pay.md)'s central untested claim), will teams actually adopt and sustain use, and is the automation mechanism technically viable against real-world data messiness (the Feasibility risk scored 4/10 in [18 — Blue Ocean Score](18-blue-ocean-score.md)).

## Week 1 — Recruit and instrument

- **Action:** recruit 5-8 design-partner teams matching the target customer in [23 — Value Proposition](23-value-proposition.md) — technical teams of 5-30 people, self-hosting at least one dev/PM tool, currently paying for or having recently churned from a per-seat OKR SaaS tool. Recruit via r/selfhosted, Hacker News (Show/Ask HN), and direct outreach to companies whose engineering blogs mention Gitea/GitLab self-hosting — not a random sample, a deliberately narrow one matching the evidenced buyer.
- **Action:** for each team, get read access to their Git commit history and current OKR/goals doc (whatever they use today — Notion, Sheets, Weekdone, nothing).
- **Metric to capture from the start:** what each team currently pays (if anything) for OKR software — this is the number [21 — Willingness to Pay](21-willingness-to-pay.md)'s redirect thesis depends on; if most recruited teams pay $0 today, that's already a warning sign the target customer definition needs narrowing.
- **Success threshold to proceed:** at least 5 teams recruited with verifiable current OKR-tool spend or a documented recent churn (Viva Goals or similar).

## Week 2 — Concierge delivery, round 1

- **Action:** manually populate each team's OKR dashboard weekly using their real Git activity data (Stage 0 from [25 — MVP](25-mvp.md)), framed to them explicitly as a preview of an automated product, not as a permanent manual service.
- **Metric — demand signal:** does each team's lead actually look at the dashboard without being prompted (trackable via a simple view-notification or a follow-up question)? Target: 60%+ of teams engage unprompted in week 2.
- **Metric — pain validation:** ask directly (structured interview, not a survey) whether manually updating OKRs today is something they find burdensome, and how much time it costs them per week. This is the direct test of the ASSUMPTION flagged in [23 — Value Proposition](23-value-proposition.md). **Invalidating result:** if most teams report manual updates take under 10 minutes/week or aren't something anyone complains about unprompted, the core differentiator has much less value than assumed, and the concept should be reconsidered before Week 3.

## Week 3 — Concierge delivery, round 2 + pricing conversation

- **Action:** continue weekly dashboard updates. Introduce the actual pricing framing from [24 — Business Model](24-business-model.md) Model A (flat-rate, e.g., a hypothetical $49-149/mo depending on team size) and directly ask: would they pay this, and would they cancel or downgrade their current OKR tool to do so.
- **Metric — willingness to pay, direct:** number of teams who give an affirmative, specific commitment (not "maybe," a stated intent to switch or a request for a contract/invoice) versus polite non-commitment. **Success threshold:** at least 2 of 5-8 teams give a specific, actionable commitment. **Kill signal:** zero teams give more than polite interest — this would directly contradict [21 — Willingness to Pay](21-willingness-to-pay.md)'s redirect thesis and should trigger a hard stop before any further engineering investment.
- **Metric — retention of engagement:** do teams that engaged in Week 2 continue engaging in Week 3 without prompting, or does interest decay? Decay by week 3 is evidence the concierge value isn't durable, independent of the automation question.

## Week 4 — Feasibility spike + synthesis

- **Action:** in parallel with the last concierge cycle, run a technical spike — actually build the single Git-commit-based automation connector described in [25 — MVP](25-mvp.md) Stage 1, against 2-3 of the design partners' real repositories.
- **Metric — technical feasibility:** does commit activity map cleanly enough to key-result progress to be useful without heavy manual tuning per team, or does every team's workflow require enough custom configuration that "automatic" is misleading? This directly tests the Feasibility concern flagged at 4/10 in [18 — Blue Ocean Score](18-blue-ocean-score.md). **Kill/pivot signal:** if the connector requires substantial per-team custom configuration to produce sensible output, the "zero-input" value proposition in [23](23-value-proposition.md) doesn't hold as stated and needs to be re-scoped (e.g., semi-automatic with human confirmation, rather than fully automatic).
- **Synthesis:** combine all four weeks' evidence into a single go/pivot/kill call against the thresholds below.

## Success criteria (set before running, not after)

| Signal | GO | PIVOT | KILL |
|---|---|---|---|
| Pain validation (Week 2) | Majority report real, felt burden from manual updates | Mixed — burden felt by some segments not others | Burden not felt or reported as trivial by most |
| Willingness to pay (Week 3) | 2+ of 5-8 teams give specific commitment | 1 team commits, others show strong interest without commitment | Zero specific commitments |
| Engagement durability (Weeks 2-3) | Sustained or growing unprompted engagement | Flat engagement | Decaying engagement |
| Technical feasibility (Week 4) | Clean automatic mapping with minimal per-team tuning | Works with meaningful but bounded per-team configuration | Requires so much manual tuning "automatic" is false advertising |

**GO** requires GO or better on at least 3 of 4 signals, with willingness-to-pay never below PIVOT (this is non-negotiable — a concept without demonstrated willingness to pay fails the central test this entire discovery process was built around, per PM principle 13). **KILL** on willingness-to-pay alone is sufficient to kill the concept regardless of the other three signals, consistent with [21 — Willingness to Pay](21-willingness-to-pay.md)'s finding that this was the concept's single strongest, and therefore most load-bearing, piece of evidence.

## What happens after

A GO result licenses building [25 — MVP](25-mvp.md) Stage 1 for real, with the design-partner teams as first paying customers. A PIVOT result should feed back into [18 — Blue Ocean Score](18-blue-ocean-score.md)'s runner-up concepts (Bus-Factor Dashboard or the Solopreneur Tier, both scored 6.5-6.67) rather than assuming the entire team-OKR wedge is dead — [06 — Pressure Test](06-pressure-test.md) already showed that single-signal kill calls in this research have twice needed correction. A KILL result on this specific concept should not be read as a kill on self-hosted goal tracking generally — see [12 — Strategic Groups](12-strategic-groups.md) for the individual-habit-tracking alternative this entire Phase 4 process deliberately set aside in favor of pursuing the stronger willingness-to-pay signal first.
