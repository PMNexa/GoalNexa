# 24 — Business Model: Three Options for Quantified Team

Three viable models, drawing on the cross-industry precedents in [16 — Cross-Industry Inspiration](16-cross-industry-inspiration.md) and the pricing benchmarks in [05 — Competitor Map](05-competitor-map.md) and [06 — Pressure Test](06-pressure-test.md). All revenue-potential figures are ASSUMPTION-level estimates benchmarked against comparable real products, not projections from actual sales data — none exist yet.

## Model A — Open-Core Hosted Cloud (Operately's model)

Free, fully-featured self-hosted core; paid flat-rate managed-cloud tiers.

- **Customer:** any team willing to either self-host (free) or pay for convenience (managed cloud).
- **Pricing:** benchmark directly against Operately's structure ([06](06-pressure-test.md)): $0 (≤10 users) / $49 (≤30) / $149 (≤100) / $249 (unlimited) per month, flat not per-seat.
- **Revenue potential:** ASSUMPTION — Operately itself doesn't disclose revenue, so there's no direct comparable figure; Plausible Analytics (a different open-core category) reached ~$1M ARR with 19,000+ paying subscribers after several years ([06](06-pressure-test.md)) — treat as an optimistic outer bound for a mature product in this model, not a near-term expectation.
- **Acquisition cost:** low-to-moderate — free self-hosted tier is itself the acquisition funnel (word of mouth, Awesome-Selfhosted listing, [13 — Complementary Products](13-complementary-products.md)); no direct sales motion required.
- **Margins:** high once built — cloud hosting cost per customer is small relative to $49-249/mo price points, standard SaaS economics.
- **Scalability:** good — this is the most proven pattern of the three ([01 — Market Map](01-market-map.md), [16](16-cross-industry-inspiration.md) model #5) and directly matches the only real competitor traction found in this whole research effort (Operately).
- **Key risk:** this model alone doesn't monetize the automation differentiator specifically — a team could self-host for free and get the automation features too, undermining the thing this product is supposed to charge for uniquely versus Operately.

## Model B — Modular Automation Add-On (razor-and-blades, [16](16-cross-industry-inspiration.md) model #1)

Free self-hosted core with manual OKR tracking (matching Operately's baseline feature set); paid connector packs for automated key-result computation (Gitea connector, GitLab connector, Vikunja/Plane connector, sold individually or bundled).

- **Customer:** technical teams specifically motivated by the automation value proposition, not just self-hosting in general — a narrower but higher-intent buyer than Model A.
- **Pricing:** ASSUMPTION, no direct precedent found for this specific packaging in this category — a plausible benchmark is per-connector pricing in the $5-15/month-per-connector range, roughly analogous to how Zapier/Make price per-integration usage, though those are usage-based SaaS, not self-hosted licensing, so this is a looser analogy than Model A's.
- **Revenue potential:** ASSUMPTION, likely lower total addressable spend than Model A since it only captures teams who value automation specifically, not the broader self-hosting-for-trust audience.
- **Acquisition cost:** higher than Model A — requires marketing the automation differentiator specifically, not just "another self-hosted OKR tool," a more specific and harder message to land.
- **Margins:** high per connector once built, but each connector is itself a maintenance burden ([09 — ERRC Grid](09-errc-grid.md) already flagged the tension between building multiple integrations and keeping the feature surface small).
- **Scalability:** moderate — scales with the number of connectors built and maintained, which is an engineering bottleneck, not just a sales one.
- **Key risk:** directly monetizes the concept's actual differentiator (good), but is the least-precedented model of the three in this specific category — no comparable example was found anywhere in this research to validate pricing or conversion assumptions.

## Model C — Managed-Install + Support Contract ([16](16-cross-industry-inspiration.md) model #7)

Free, fully open-source software; revenue from annual support/maintenance contracts and partner-delivered managed installation, targeting larger or compliance-constrained teams (the Compliance Mode concept, [14](14-blue-ocean-concepts.md) #12) who need guaranteed support, not just working software.

- **Customer:** larger self-hosting-averse-but-required teams (regulated industries, [10 — Noncustomers](10-noncustomers.md) Tier 3's unvalidated regulated-niche segment) willing to pay for a support relationship rather than self-serve.
- **Pricing:** ASSUMPTION — the GitLab self-managed TCO analysis ($81,934/yr premium over SaaS at small non-HA scale, [06 — Pressure Test](06-pressure-test.md)) suggests there's real budget for managed self-hosted support at the higher end of this market, though that figure describes cost avoided, not a price this product could directly charge.
- **Revenue potential:** ASSUMPTION, potentially the highest per-customer of the three (enterprise support contracts typically command more than self-serve SaaS), but gated by an entirely unvalidated buyer segment — [06 — Pressure Test](06-pressure-test.md) explicitly flagged the regulated-niche team-OKR buyer as not found in this research, only hypothesized.
- **Acquisition cost:** highest of the three — enterprise/regulated-sector sales cycles are slow and relationship-driven, requiring a sales motion this desk research has no evidence the team could execute cheaply.
- **Margins:** lower initially (support is labor-intensive) but improves with scale and partner leverage ([14](14-blue-ocean-concepts.md) concept #13's consultancy-partner model).
- **Scalability:** weakest of the three near-term — bottlenecked by support capacity and sales cycle length, though it has the highest ceiling if the regulated-niche segment turns out to be real and large.

## Comparison table

| | Model A: Open-Core Cloud | Model B: Modular Automation | Model C: Managed-Install + Support |
|---|---|---|---|
| Precedent strength | Strong (Operately, Plausible) | None found in-category | Weak — general pattern, no direct comparable |
| Monetizes the actual differentiator | No — automation could ship free | Yes, directly | Indirectly, via support relationship |
| Acquisition cost | Low | Moderate | High |
| Near-term revenue potential | Moderate | Lower | Potentially highest, least certain |
| Engineering risk | Standard | Higher (per-connector maintenance) | Standard, plus support-ops burden |
| Validated by this research | Most | Least | Least (buyer segment itself unvalidated) |

## Recommendation

RECOMMENDATION — **start with Model A**, but gate the automation features specifically behind the paid cloud tier rather than the self-hosted free tier, borrowing Model B's monetization logic without its unprecedented packaging risk. This keeps the proven acquisition motion (free self-host as funnel, matching Operately) while still charging for the one thing Operately doesn't have. Treat Model C as a later-stage option contingent on first validating the regulated-niche segment directly — building a support-contract sales motion around an unvalidated buyer, per [06 — Pressure Test](06-pressure-test.md), would be premature.
