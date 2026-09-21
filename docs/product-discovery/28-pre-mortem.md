# 28 — Pre-Mortem: It's Three Years Later and This Failed

Assume Quantified Team was built and shut down. The 10 most likely causes, ranked by plausibility given the evidence in docs 01-27, each with what would have had to be true for it to be the actual cause.

## 1. SaaS incumbents copied the automation feature without self-hosting

The [27 — Red Team](27-red-team.md) finding materializes: Weekdone, Perdoo, or Quantive ships a GitHub/GitLab activity connector as a normal SaaS feature, and teams get the automation benefit without giving up SaaS convenience. This product's actual differentiator turns out to have been rentable by anyone, not defensible.

## 2. The core pain was never real enough to drive switching

[19 — Strategic Fit](19-strategic-fit.md) and [23 — Value Proposition](23-value-proposition.md) already flagged this: manual OKR updates, while plausible-sounding, weren't costly enough in practice to make teams change tools or pay more. [26 — Experiment](26-experiment.md)'s Week 2 pain-validation step either wasn't run rigorously, or was run and the warning signs were rationalized away instead of acted on.

## 3. Operately (or a similar incumbent) simply out-executed on distribution

Operately already had 559 GitHub stars, daily commits, and real community presence before this product existed ([06 — Pressure Test](06-pressure-test.md)). A better-distributed incumbent adding a comparable feature reaches the same buyers faster than a new entrant building an audience from zero.

## 4. The addressable market was structurally too small

[27 — Red Team](27-red-team.md)'s comparison to self-hosted CRM (Twenty: ~45-56K stars vs. Operately's 559) turns out to have been the right read — self-hosted team-goal tracking tops out as a niche within a niche, incapable of supporting a sustainable business past the founder(s)' own runway.

## 5. Maintainer burnout stalled the project, mirroring the category's own pattern

[06 — Pressure Test](06-pressure-test.md) found ~60% of OSS maintainers are unpaid and ~60% have considered quitting from burnout — and this research already documented in-category casualties (an UNMAINTAINED-tagged repo, the archived okr2go project, [03](03-customer-pain.md)). This product joins that list rather than escaping it, especially if [24 — Business Model](24-business-model.md)'s Model A revenue never grew fast enough to fund a paid team.

## 6. The integration-maintenance treadmill exceeded the team's capacity

[18 — Blue Ocean Score](18-blue-ocean-score.md) scored Feasibility at only 4/10 for good reason: Gitea, GitLab, Vikunja, and Plane all evolve their APIs independently. Each broken connector is a support incident; maintaining several in parallel with a small team becomes the majority of engineering time, crowding out anything else.

## 7. "Automatic" key-result computation produced misleading data teams didn't trust

Commit counts and task-completion percentages are well-known weak proxies for actual progress in software engineering management generally. If the automation mechanism produced numbers that looked plausible but didn't match teams' own sense of progress, users would rationally stop trusting the dashboard — worse than a manual tool, because it actively misleads rather than just requiring effort.

## 8. Pricing pressure — too few teams ever reached the paid tier

[21 — Willingness to Pay](21-willingness-to-pay.md) already flagged this as the central open risk: the target segment (5-30 person self-hosting technical teams) is real but narrow, and [24 — Business Model](24-business-model.md)'s Model A depends on enough of them converting from free self-hosted to paid cloud to sustain the business. If conversion rates matched typical open-core benchmarks (a small single-digit percentage) against a small total population, revenue never cleared the bar to justify continued investment.

## 9. The regulated-niche hedge (Compliance Mode) was never validated and the team bet on it too late

[06](06-pressure-test.md) and [24 — Business Model](24-business-model.md) both flagged the regulated-industry segment as a real but completely unvalidated potential hedge. If the core wedge underperformed and the team pivoted toward Compliance Mode without ever having done the direct segment validation [06](06-pressure-test.md) called for, they'd have burned runway chasing a second unvalidated hypothesis instead of a tested one.

## 10. The team never ran (or ignored the result of) the 30-day experiment

The most avoidable cause: [26 — Experiment](26-experiment.md) was designed with explicit GO/PIVOT/KILL thresholds specifically to prevent building on an unvalidated assumption. If the actual failure mode was "we built it anyway despite a KILL-level signal in week 3," that's not a market failure — it's a process failure this document set explicitly tried to prevent.

## What this pre-mortem implies

INSIGHT — causes #1, #2, #4, and #7 are variations on the same root issue [27 — Red Team](27-red-team.md) already surfaced: **the automation differentiator may be both weakly evidenced and easily replicated**, which is a worse combination than either problem alone. Causes #5, #6, #8, and #9 are operational/execution risks that exist regardless of whether the core thesis is right — they'd apply to almost any small open-source-adjacent business in this category. Cause #10 is the one this whole document set is explicitly built to prevent. See [31 — Final Decision](31-final-decision.md) for how heavily these weigh against a GO recommendation.
