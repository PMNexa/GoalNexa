# 13 — Complementary Products: Removing Friction Around the Core Experience

Products, services, and stakeholders that surround a self-hosted goal tracker's actual use, per Blue Ocean's complementary-products lens: what happens before, during, and after someone uses the core product that shapes whether the whole experience feels frictionless or painful.

## Before: discovery and deployment

- **Awesome-Selfhosted** (320,103 GitHub stars, [01 — Market Map](01-market-map.md)) is the de facto discovery layer for this entire market — the list a self-hoster checks before building or adopting anything. No dedicated "goal tracking" category exists there today; getting listed correctly, in a category that doesn't yet exist as a clean subheading, is itself a friction point for discoverability.
- **One-click deploy platforms** — Coolify (280+ free one-click apps), CapRover (346 free apps), PikaPods ($2-4/mo managed, slider setup), and Railway (Operately's own deploy path) — are the complementary layer that turns "self-hosted" from a technical commitment into a five-minute decision ([06 — Pressure Test](06-pressure-test.md)). A product's listing (or absence) in these catalogs is now as important a distribution lever as its own marketing site.
- **Reverse proxies and SSO** — Authelia (29,017 GitHub stars) and Authentik (25,647 stars) are the standard way self-hosters put a login wall in front of dashboards and internal tools; both work with Traefik/Caddy/nginx, which most self-hosted stacks already run. A goal tracker that doesn't support forward-auth/OIDC out of the box creates friction for exactly the audience ([10 — Noncustomers](10-noncustomers.md), Tier 3) most likely to adopt it — HabitSync already supports OIDC/SSO per [05 — Competitor Map](05-competitor-map.md), the only competitor found to do so.

## During: the daily-use surface

- **Homelab dashboards** — Homepage (32,753 GitHub stars) is the startpage/dashboard many self-hosters open first every day, aggregating widgets from other self-hosted services. A goal tracker with zero presence there requires its own separate visit; one with a Homepage widget shows up inside a routine the user already has, which is a meaningfully lower-friction path to daily engagement than any in-app gamification mechanic reviewed in [08 — Strategy Canvas](08-strategy-canvas.md).
- **Notification/relay layer** — Apprise (17,359 GitHub stars) fans a single alert out to 80+ notification services (Slack, ntfy, Discord, email, etc.). HabitSync already integrates it ([05](05-competitor-map.md)); this is the standard self-hosted-world answer to "how do I get reminded" without building push-notification infrastructure from scratch.
- **CalDAV/calendar and Home Assistant integration** — not directly evidenced with usage data in this research (flagged as ASSUMPTION, not FACT), but a natural complementary surface for habit/goal check-ins given how central Home Assistant is to the same self-hosting audience documented in [01 — Market Map](01-market-map.md) (r/homelab, ~1.1M members).

## After: data portability and trust maintenance

- **Migration-in paths from existing solutions.** [04 — Current Solutions](04-current-solutions.md) established that most people's *actual* current tool is a Notion page, a Google Sheet, or an Obsidian vault, not a competing dedicated tracker. An import path from these (not from Habitica or BeaverHabits) is the complementary product most directly tied to actual switching behavior — and none of the competitors in [05 — Competitor Map](05-competitor-map.md) were found to offer this.
- **Backup tooling** — Duplicati, restic, and similar self-hosted backup tools are standard companions to any self-hosted service holding data someone cares about; not offering a documented backup/export story undercuts the "your data, your control" pitch that is this whole category's core differentiator ([07 — Industry Factors](07-industry-factors.md), factor #1).
- **Sustainability/maintenance transparency**, as raised in [09 — ERRC Grid](09-errc-grid.md) — Beeminder's public `beeminder.com/meta` dashboard is the clearest existing example of a complementary "trust artifact" (a page proving the product is alive and funded) rather than a feature of the product itself.

## Stakeholders beyond the end user

- **The self-hosting household/team administrator** is frequently not the only person using the service — a habit tracker used by a family, or an OKR tool used by a small team, has a deploy-and-maintain stakeholder (the admin) distinct from the day-to-day user. Multi-user support with sane permissions (HabitSync supports "friend groups," [05](05-competitor-map.md)) is a complementary need this distinction creates.
- **The open-source contributor/maintainer community** is itself a stakeholder whose health determines whether the "trust" value proposition holds over time — [06 — Pressure Test](06-pressure-test.md) found the general OSS maintainer base is ~60% unpaid and ~60% have considered quitting from burnout, which makes this stakeholder's sustainability a first-class product-strategy concern, not an afterthought.

## Strategic read

INSIGHT — almost every complementary product identified here (Homepage, Authelia/Authentik, Apprise, one-click deploy catalogs) is already large, established, and specific to the self-hosting audience identified as the most under-served noncustomer tier in [10 — Noncustomers](10-noncustomers.md). RECOMMENDATION: treat integration with this existing ecosystem — not competing feature-for-feature with SaaS incumbents — as the primary distribution and retention strategy for whichever wedge ([12 — Strategic Groups](12-strategic-groups.md)) is pursued. This is a cheaper, more differentiated lever than anything in the direct competitive set has used, including Operately, which integrates with none of these self-hosting-specific tools despite being the strongest competitor found in the entire discovery process.
