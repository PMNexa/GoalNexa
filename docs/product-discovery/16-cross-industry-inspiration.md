# 16 — Cross-Industry Inspiration: 10 Business Models to Adapt

Business models proven in unrelated industries, each with the specific transferable mechanism to a self-hosted goal tracker. All are FACT-grounded in how the source industry actually operates; the adaptation itself is a HYPOTHESIS.

## 1. Razor-and-blades (Gillette)

Cheap/free core hardware, recurring revenue from the consumable. **Transferable mechanism:** free, fully-featured self-hosted core; paid "consumable" is not a subscription but a recurring need — premium template packs, generated reports, or data-export/migration tooling consumed repeatedly rather than a seat license.

## 2. Freemium mobile gaming with cosmetic/near-miss monetization (Duolingo)

FACT — Duolingo pairs free access for ~90% of users with in-app purchases (streak freezes, gem-based power-ups) plus a subscription tier (Super/Max); under 5% convert to IAPs, but scale (100M+ monthly actives) makes it work, and the real revenue driver is the subscription, not the IAPs. ([Quartr](https://quartr.com/insights/edge/keeping-the-streak-alive-the-story-of-duolingo), [AppMakers USA](https://appmakersla.com/blog/popular-apps/how-duolingo-makes-money/)) **Transferable mechanism:** the "near-miss nudge" (offering a streak-freeze purchase right after almost losing a long streak) is a monetization moment tied to genuine emotional stakes — directly adaptable to any streak-based self-hosted tracker, though [03 — Customer Pain](03-customer-pain.md) also shows this exact mechanic drives resentment when handled as pay-to-unlock rather than opt-in.

## 3. Assurance/commitment contracts (StickK, insurance industry logic)

Already documented in [11 — Alternative Industries](11-alternative-industries.md): StickK's own data shows 78% success with money + referee vs. 35% without. **Transferable mechanism:** the underlying economic idea — an assurance contract that only triggers a cost when you fail — is the core mechanism behind concept #2/#10 in [14 — Blue Ocean Concepts](14-blue-ocean-concepts.md), applicable without a self-hosted product ever holding funds itself (route to a third-party charity/escrow).

## 4. Public broadcasting / Wikipedia donation drives

Well-established, publicly documented funding model: recurring, transparent, low-pressure donation asks tied to visible mission/usage stats rather than gated features. **Transferable mechanism:** an annual "keep this running" campaign paired with the Bus-Factor Dashboard concept (#5, [14](14-blue-ocean-concepts.md)) — funding tied to transparency about what the money does, not to unlocking withheld features.

## 5. Open-core infrastructure (GitLab, Elastic)

Already the primary business-model reference throughout [01 — Market Map](01-market-map.md) and validated in-category by Operately ([06 — Pressure Test](06-pressure-test.md)). **Transferable mechanism:** free self-hosted core, paid managed-cloud tier — the most directly applicable model of the ten, since it's already working for the closest comparable competitor.

## 6. Plugin/extension marketplaces (WordPress plugins, Obsidian community plugins)

FACT — the Obsidian habit-tracking plugin ecosystem alone has 18 entries ([04 — Current Solutions](04-current-solutions.md)), evidence this distribution model works for exactly this problem space already, just inside someone else's platform. **Transferable mechanism:** a public plugin API (for Home Assistant integration, Strava import, custom notification channels) lets the community build the long tail of integrations no core team could justify building itself — directly enables concept #4 (Auto-Habit) and #15 (Quantified Team) in [14](14-blue-ocean-concepts.md) without the core team owning every integration.

## 7. Managed service provider / franchise model (IT consultancies, Geek Squad-style installers)

Referenced directly in [06 — Pressure Test](06-pressure-test.md): an HN commenter fantasized about a consultancy that installs and maintains self-hosted OSS for non-technical small businesses — evidence this gap is recognized, not hypothetical. **Transferable mechanism:** a certified-installer/partner program (revenue share with IT consultancies who deploy and maintain the product for SMB clients) turns the barrier identified in [06](06-pressure-test.md) — non-technical buyers can't run Docker — into a distribution channel rather than a dead end. Directly underlies concept #13 in [14](14-blue-ocean-concepts.md).

## 8. Deposit/no-show fee fitness studios (boutique gym cancellation-fee models)

Common, well-documented industry practice: studios charge a fee for missed bookings to align incentives between the business and the customer's own stated intent to show up. **Transferable mechanism:** a lighter-weight cousin of the StickK/Beeminder stakes model — instead of an open-ended financial pledge, a small, capped, opt-in "commitment deposit" per goal-period, refunded on completion — a gentler on-ramp to the commitment-device mechanic for users who'd reject Beeminder's open-ended penalty scaling.

## 9. NAS appliance hardware bundling (Synology vs. Unraid)

FACT — Synology bundles hardware, OS, app catalog, and support into one vendor-controlled package at a premium price ("it just works"), while Unraid sells a flexible OS license for user-assembled hardware ("more powerful, asks more of the operator"). ([raidsize.com comparison](https://raidsize.com/blog/en/unraid-vs-synology)) **Transferable mechanism:** this is the same fork this whole category faces — a polished, pre-flashed "goal tracker appliance" (a small pre-configured device, concept #19 in [14](14-blue-ocean-concepts.md)) sold once at a premium to the convenience-seeking end of the self-hosting audience, versus a pure-software release for the Unraid-style tinkerer segment. Running both simultaneously, the way the NAS market does, may be more viable than picking one.

## 10. Crowdfunding / milestone pre-orders (Kickstarter-funded open-source hardware and software projects)

Well-established model: backers fund specific development milestones publicly and receive early access or a lifetime license in exchange, rather than paying a recurring fee. **Transferable mechanism:** fund a specific roadmap item (e.g., the Compliance Mode concept, #12 in [14](14-blue-ocean-concepts.md)) via a public pledge campaign rather than building it speculatively — directly tests real willingness-to-pay for a specific feature before committing engineering time, addressing the "no monetization precedent" gap found in [06 — Pressure Test](06-pressure-test.md).

## Strategic read

INSIGHT — models #3, #7, and #10 share a common thread: each converts a *validation question this research couldn't answer with desk research alone* (will people pay for stakes, will non-technical buyers pay for managed install, will a team pay for compliance features) into a business model that tests the answer while generating revenue, rather than requiring the answer to be known in advance. RECOMMENDATION: prioritize these three for early validation design over models #1/#2/#9, which assume a working product and existing user base already exist.
