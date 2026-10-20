# Feature map

Every GoalNexa feature - the self-hosted product, the hosted edition and
the phone apps - where it's built, and whether it comes to the phone
apps. The apps are for the daily loop - see what's due, check in,
see how a goal is going; setting things up stays on the website.

This is the whole-product view. Per-feature mobile detail (notes, store
work) is in `docs/mobile-features.md`; roadmap items are in
`docs/roadmap.md`. The phone apps' source and the hosted edition's extras
(landing page, plans, push relay) live in the private `goalnexa-cloud`
repo, but their rows are kept here, so this is the one map. Update a row
in the same PR that changes the feature; a change made in `goalnexa-cloud`
updates its row with a PR here (cloud gets it back through the daily
sync).

**Status**: **Done** - built (apps: tried on a device) · **Built** - built,
not yet tried on a device · **Partial** - part of it (see notes) ·
**Planned** - on the roadmap · **Later** - wanted, no roadmap item ·
**-** - not on that platform.

**Mobile**: **Ported** - in the apps · **Planned** - coming, with its
roadmap item · **Later** - may come, not planned · **Web only** - stays on
the website, with the reason.

Last updated: 2026-10-20.

## Accounts and sign-in

| Feature | Backend | Website | Android | iOS | Mobile | Notes |
|---|---|---|---|---|---|---|
| Email + password sign-in | Done | Done | Done | Planned | Ported | Apps use a native session (P-67) |
| Single sign-on (OpenID Connect) | Done | Done | Built | Planned | Ported | Apps: PKCE back to the app (P-68); untested with a real provider |
| Sign up | Done | Done | Done | Planned | Ported | Apps: native session; "Check your email" when the server confirms emails |
| First-run setup (first admin) | Done | Done | - | - | Web only | Self-hosted install step |
| Email verification, password reset | Done | Done | Done | Planned | Ported | Apps resend the link and ask for a reset; the links open the website |
| Lockout and password rules | Done | Done | Built | Planned | Ported | Server-side; the apps show its errors |
| Change password, sessions, sign out everywhere | Done | Done | - | - | Later | The app's session shows in the list as "App on <device>" |
| Sign out | Done | Done | Done | Planned | Ported | |
| Delete account | Done | Done | Partial | Planned | Ported | Store requirement; SSO-only accounts can't yet in the app |
| Export my data | Done | Done | - | - | Web only | A file download |
| Two-factor login | Planned | Planned | Planned | Planned | Planned | P-01; the apps need it when it ships |

## Goals and metrics

| Feature | Backend | Website | Android | iOS | Mobile | Notes |
|---|---|---|---|---|---|---|
| Goal list with progress, projection, health | Done | Done | Done | Planned | Ported | |
| Sub-goals and sub-metrics (trees) | Done | Done | Done | Planned | Ported | |
| Goal page: metrics with reading, % and pace | Done | Done | Done | Planned | Ported | |
| Create and edit goals and metrics | Done | Done | Done | Planned | Ported | Apps: the goal and metric pages' menus; template goals and totals stay read-only |
| Onboarding wizard | Done | Done | - | - | Web only | |
| Manual order, drag and drop | Done | Done | - | - | Web only | The apps show the order |
| Archive, status | Done | Done | Done | Planned | Ported | Archived goals are hidden in the apps |
| Goal visibility and goal members | Done | Done | - | - | Web only | The apps show what the user may see |
| Tracked-only metrics | Done | Done | Built | Planned | Ported | Value instead of % |
| Sum vs. latest metrics | Done | Done | Done | Planned | Ported | The check-in label follows it |
| Targets per period, hit rate, streaks | Done | Done | Built | Planned | Ported | "6/10 km today - 4 to go" |
| One reading per period | Done | Done | Built | Planned | Ported | Says what it replaced |
| Check-ins for a period (`snap_to`) | Done | Done | Done | Planned | Ported | Says which period it went to; dated at its moment (P-80, picked in one menu on the web, inherited down the tree) - server-side, so app check-ins get it too |
| Check-in schedules and due dates | Done | Done | Done | Planned | Ported | Shown on Today; set on a metric |
| Ingest URL per metric | Done | Done | - | - | Web only | For scripts and services |

## Check-ins

| Feature | Backend | Website | Android | iOS | Mobile | Notes |
|---|---|---|---|---|---|---|
| Check in with a value and note | Done | Done | Done | Planned | Ported | |
| Backdate a check-in | Done | Done | Done | Planned | Ported | |
| Attribution (web, agent, mobile, ingest) | Done | Done | Done | Planned | Ported | `X-GoalNexa-Client: mobile` |
| No duplicates on retry (`client_ref`) | Done | - | Built | Planned | Ported | P-69; the web doesn't need it |
| Edit or delete a check-in | Done | Done | Done | Planned | Ported | Apps: the metric page |
| Check-in table (many metrics at once) | Done | Done | - | - | Web only | Wide table; Today covers the phone case |
| Bulk check-ins (team board) | Done | Done | - | - | Web only | |
| Check in from a notification | Planned | - | Planned | Planned | Planned | P-74 |
| Check-ins queued offline | Done | - | Planned | Planned | Planned | P-77 |

## Today and dashboard

| Feature | Backend | Website | Android | iOS | Mobile | Notes |
|---|---|---|---|---|---|---|
| Today: due, this period's quotas, at risk | Done | - | Done | Planned | Ported | `GET today` (P-70); the web has the dashboard instead |
| Dashboard (charts per goal, filters, tree) | Done | Done | Partial | Planned | Ported | Apps: a chart per metric on the goal page |
| Charts: projection, target date, now | Done | Done | Done | Planned | Ported | Server series (P-71), drawn on the phone |
| Switch organization / personal goals | Done | Done | Done | Planned | Ported | Website: only in the header; the dashboard, check-in table and team board follow it |
| Organization and team tags on goals | Done | Partial | Done | Planned | Ported | Web: team and Total tags on the dashboard (`GoalTag`); apps: organization (in "All goals") and team |
| Cycle filter on the dashboard | Done | Done | - | - | Later | |
| Team filter on the dashboard | Done | Done | - | - | Later | |
| Public dashboard links (share) | Done | Done | - | - | Later | Viewing a link works in the phone's browser |
| Embeds, badges | Planned | Planned | - | - | Web only | P-10 |
| Home screen widget, app shortcuts | Done | - | Planned | Planned | Planned | P-77 |

## Teams and organizations

| Feature | Backend | Website | Android | iOS | Mobile | Notes |
|---|---|---|---|---|---|---|
| Organizations and roles | Done | Done | - | - | Web only | The apps only switch between them |
| Invite and accept invitations | Done | Done | Partial | Planned | Ported | Apps accept or decline (on Today); inviting stays on the web |
| Teams and the org chart | Done | Done | - | - | Web only | |
| Goal templates | Done | Done | - | - | Web only | Template goals and metrics carry the check-in setting, inherited like goals; teams' copies follow it |
| Team board (targets, apply, who plays) | Done | Done | - | - | Web only | Big grid; "Open on the web" from the app |
| Team totals (rollups) | Done | Done | Done | Planned | Ported | Read-only, labeled |
| Cycles: close, scores, roll over | Done | Done | - | - | Web only | |
| Activity feed | Done | Done | Done | Planned | Ported | |
| Comments on goals | Done | Done | Partial | Planned | Ported | Read in the apps; writing later |
| Organization time zone | Done | Done | Done | Planned | Ported | Server's numbers; set on the web |

## Reminders and email

| Feature | Backend | Website | Android | iOS | Mobile | Notes |
|---|---|---|---|---|---|---|
| Reminders through Apprise (Telegram, email...) | Done | Done | - | - | Web only | Settings page; push replaces it on phones |
| Push notifications (relay) | Planned | - | Planned | Planned | Planned | P-73, P-74: due, quota short, digest |
| More push: comments, health, UnifiedPush | Planned | - | Planned | Planned | Planned | P-78; UnifiedPush Android only |
| Digest (daily/weekly) | Done | Done | - | - | Planned | By push in P-74 |
| End-of-period nudges | Done | Done | - | - | Planned | By push in P-74 |
| Lifecycle email, email preferences | Done | Done | - | - | Web only | |

## AI assistants (MCP)

| Feature | Backend | Website | Android | iOS | Mobile | Notes |
|---|---|---|---|---|---|---|
| MCP server and OAuth connect | Done | Done | - | - | Web only | Assistants talk to the server directly |
| Personal access tokens | Done | Done | - | - | Web only | |
| Connect wizard and client guides | Done | Done | - | - | Web only | |
| Agent skills | Done | Done | - | - | Web only | |
| Chart in the chat | Done | - | - | - | Web only | `goals_chart` tool |

## Administration (system console)

| Feature | Backend | Website | Android | iOS | Mobile | Notes |
|---|---|---|---|---|---|---|
| Users, roles, permissions | Done | Done | - | - | Web only | Operators only |
| Settings, status, announcement | Done | Done | - | - | Web only | `min_app_version` is a setting (P-72) |
| Audit log | Done | Done | - | - | Web only | |
| Insights | Done | Done | - | - | Web only | |
| All organizations, limits | Done | Done | - | - | Web only | |
| View as a user | Done | Done | - | - | Web only | |
| Data retention | Done | Done | - | - | Web only | |
| "Update the app" (minimum app version) | Done | - | Built | Planned | Ported | P-72 |

## Hosted service and billing (goalnexa-cloud)

| Feature | Backend | Website | Android | iOS | Mobile | Notes |
|---|---|---|---|---|---|---|
| Landing, pricing, legal pages | - | Done | - | - | Web only | Links the Play listing |
| Plans and payment | Done | Done | - | - | Web only | Selling in the apps would need Play / App Store billing |
| Plan limits (members, goals) | Done | Done | Built | Planned | Ported | The apps show the server's "limit reached" |
| Push relay service | Planned | - | - | - | Planned | P-73; free, self-hosted servers too |

## Platform and release

| Feature | Backend | Website | Android | iOS | Mobile | Notes |
|---|---|---|---|---|---|---|
| Light and dark theme | - | Done | Built | Planned | Ported | |
| Translations | Planned | Planned | Later | Later | Later | P-16; the apps are English only |
| API reference (OpenAPI) | Done | Done | - | - | Web only | Apps: generated client planned (P-75) |
| CI | Done | Done | Done | Planned | - | `android-ci.yml`; iOS needs a macOS runner |
| Store release | - | - | Done | Planned | Ported | P-76: an `android-v<x.y.z>` tag uploads to Play's internal track; P-79 (iOS) |
| Backup and restore, import/export | Planned | Planned | - | - | Web only | P-07..P-09 |
