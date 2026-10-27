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

Last updated: 2026-10-26.

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
| Team board: members' own targets | Done | Done | - | - | Web only | P-91. A member's own copy reaches the apps as an ordinary goal (not tried on a device); assigning stays on the web |
| Team totals (rollups) | Done | Done | Done | Planned | Ported | Read-only, labeled |
| Cycles: close, scores, roll over | Done | Done | - | - | Web only | |
| Activity feed | Done | Done | Done | Planned | Ported | |
| Comments on goals | Done | Done | Partial | Planned | Ported | Read in the apps; writing later |
| Organization time zone | Done | Done | Done | Planned | Ported | Server's numbers; set on the web |

## Reminders and email

| Feature | Backend | Website | Android | iOS | Mobile | Notes |
|---|---|---|---|---|---|---|
| Reminders through Apprise (Telegram, email...) | Done | Done | - | - | Web only | Settings page; push replaces it on phones |
| Push notifications (relay) | Done | Done | Built | Planned | Ported | P-73, P-74: due, quota short, digest; the Reminders page turns it on or off next to Apprise and email |
| More push: comments, health, UnifiedPush | Planned | - | Planned | Planned | Planned | P-78; UnifiedPush Android only |
| Digest (daily/weekly) | Done | Done | Built | Planned | Ported | Also by push (P-74) |
| End-of-period nudges | Done | Done | Built | Planned | Ported | Also by push (P-74) |
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
| Landing, pricing, legal pages | - | Done | - | - | Web only | Links the Play listing; `/okr` and `/kpi` category pages (C-23); robots.txt, sitemap, canonical URLs, share cards, structured data (C-25) |
| Plans and payment | Done | Done | - | - | Web only | Selling in the apps would need Play / App Store billing |
| Plan limits (members, goals) | Done | Done | Built | Planned | Ported | The apps show the server's "limit reached" |
| Push relay service | Done | - | - | - | Ported | P-73; free, self-hosted servers too; sends once the Firebase project and its credentials are set up |
| Domains | Done | Done | - | - | Web only | `goal.pmnexa.com` is the address (links, canonical URLs, sitemap); `goalnexa.binhnguyen.org` keeps serving for existing connectors, listings, older app builds and webhooks - never retired or redirected |
| Mail sender on pmnexa.com | On hold | - | - | - | - | Mail still comes from `@goalnexa.binhnguyen.org` while its links point at `goal.pmnexa.com`; moving the sender (Amazon SES domain + DKIM) is paused for now |

## Platform and release

| Feature | Backend | Website | Android | iOS | Mobile | Notes |
|---|---|---|---|---|---|---|
| Light and dark theme | - | Done | Built | Planned | Ported | |
| Translations | Planned | Planned | Later | Later | Later | P-16; the apps are English only |
| API reference (OpenAPI) | Done | Done | - | - | Web only | Apps: generated client planned (P-75) |
| CI | Done | Done | Done | Planned | - | `android-ci.yml`; iOS needs a macOS runner |
| Store release | - | - | Done | Planned | Ported | P-76: an `android-v<x.y.z>` tag uploads to Play's internal track; P-79 (iOS) |
| Backup and restore, import/export | Planned | Planned | - | - | Web only | P-07..P-09 |

## Ideas: use cases and journeys not served yet

Brainstormed 2026-10-26 from the product discovery (`docs/product-discovery/02-customer-jobs.md`)
and the people GoalNexa already serves. They continue the numbering of
`docs/user-guide/01-use-cases.md` (UC-01..UC-19) and `02-user-journeys.md`
(J1..J6); once one is built, it moves there. Nothing here is a commitment:
to plan an idea, add it to `docs/roadmap.md` as `Proposed` - the requirement
is written there, never here - and its row below takes the item's ID.

### New use cases

| ID | Use case | Actor | What's missing today |
|---|---|---|---|
| UC-20 | Let a coach or accountability partner follow my personal goals | Individual, coach | Goal members exist only on org goals; a personal goal can't be shown to one person |
| UC-21 | Run household goals (savings, chores, kids' reading) | Family | Kids need accounts without email; check-in must be one tap |
| UC-22 | Report progress to a client every month | Freelancer, agency | Share links are pulled, not sent; no scheduled report |
| UC-23 | Send the monthly investor or board update | Founder | Same, plus a written summary of what moved |
| UC-24 | Give every person (rep, student) the same goals | Sales manager, teacher | Templates apply per team; a team per person is a workaround |
| UC-25 | Run a group challenge ("30 days, 10k steps") | Community, team | No join link, start/end or leaderboard |
| UC-26 | Go through a report's goals in a 1:1 | Manager | No per-person view, no notes kept between 1:1s |
| UC-27 | Fill metrics from a watch or fitness app | Individual | Only the ingest URL; no Health Connect, Apple Health or Strava |
| UC-28 | Take a break without failing (holiday, illness) | Individual | Reminders, health and streaks keep running |
| UC-29 | Learn from a cycle: what worked, what didn't | Team lead | Closing scores goals but keeps no lessons |
| UC-30 | Show what my goals contribute to | Team member, lead | A goal can't point at another tree's goal (personal -> team -> org) |
| UC-31 | Track the work that moves a number | Team member | Goals have metrics, not the actions behind them |
| UC-32 | Move from Viva Goals, Weekdone, Perdoo or Tability | Org admin | Import is CSV/Notion only (P-09) |
| UC-33 | Check in without opening anything | Individual, team member | Reminders can't be answered; no voice check-in |
| UC-34 | Look back on the year | Individual | No recap across goals and cycles |
| UC-35 | See goal numbers in the tools I already watch | Self-hoster, team lead | No calendar feed, Grafana/Prometheus or Home Assistant |

### New journeys

**J7. Coach and client** (UC-20) - client plans "Lose 6 kg by March" ->
invites the coach to that personal goal -> checks in weekly, sometimes with
a photo -> coach reads the chart and comments -> both see the streak.
Needs: personal-goal followers, check-in attachments, reactions.

**J8. Founder's monthly update** (UC-23) - pulls MRR, users and runway
(P-85) -> picks the goals once -> on the 1st an email goes to investors
with the charts and a short "what moved, what's at risk" -> replies land in
the founder's inbox. Needs: scheduled stakeholder updates.

**J9. Falling off and coming back** (UC-28, customer job 2) - misses a
week -> GoalNexa doesn't pile up reminders; the next one offers "pause" or
"lower the target" -> resumes; the streak survives on grace days -> the
digest says "back on track". Needs: pause, grace days, comeback nudge.

**J10. Leaving Viva Goals** (UC-32) - admin exports from the old tool ->
imports, maps owners to invited members, previews -> cycles, goals,
metrics and history arrive -> the team checks in the next Monday as
before. Needs: competitor importers.

**J11. Group challenge** (UC-25) - organizer creates "October steps" from
a template, start and end dates -> shares a join link -> people join with
one click and check in from the app or assistant -> leaderboard and
reactions keep it going -> closing names the winners. Needs: challenges,
leaderboard, reactions.

**J12. Manager's 1:1s** (UC-26) - before a 1:1, opens the person's page:
their goals, what's due or at risk, comments since last time -> adds
private notes and agreed next steps -> next 1:1 starts from them.
Needs: 1:1 view, initiatives.

**J13. Quantified self** (UC-27, UC-35) - connects Health Connect in the
Android app -> steps, sleep and workouts check in on their own ->
Home Assistant shows today's quota on the wall tablet -> the calendar
shows target dates. Needs: health sync, Home Assistant, calendar feed.

**J14. Year in review** (UC-29, UC-34) - in December, opens the recap:
goals achieved, longest streaks, best month, lessons written at each cycle
close -> drafts next year's goals from it with the assistant.
Needs: reflections at close, year recap.

### Feature ideas

| Feature | Backend | Website | Android | iOS | Mobile | Notes |
|---|---|---|---|---|---|---|
| Followers on personal goals (coach, partner) | Later | Later | Later | Later | Later | UC-20, J7; read + comment, no org needed |
| Pause a goal or metric | Later | Later | Later | Later | Later | UC-28, J9; freezes schedule, reminders, health, streak |
| Grace days for streaks | Later | Later | Later | Later | Later | J9; N missed periods a month don't break a streak |
| Comeback nudge | Later | - | - | - | Later | J9; after a missed spell, one message offering pause / lower target instead of more reminders |
| Milestones on a metric | Later | Later | Later | Later | Later | Dated in-between targets; the expected line follows them, not a straight line (seasonal work) |
| Formula metrics | Later | Later | Later | Later | Later | Value computed from other metrics (conversion = signups / visits) |
| Initiatives under a goal | Later | Later | Later | Later | Later | UC-31, J12; actions with owner, due date, done - don't count toward % |
| Alignment links and map | Later | Later | Later | Later | Later | UC-30; "contributes to" across personal, team and org trees |
| Reflections at cycle close | Later | Later | - | - | Web only | UC-29, J14; what worked / what didn't, shown when planning the next cycle |
| Answer a reminder with a number | Later | - | - | - | Web only | UC-33; reply to the email or Telegram message, it becomes a check-in |
| Attachments on check-ins | Later | Later | Later | Later | Later | J7; a photo or file as evidence |
| Reactions on check-ins | Later | Later | Later | Later | Later | J7, J11; one-tap encouragement in the feed |
| Voice check-in, watch tile | - | - | Later | Later | Later | UC-33; Google Assistant App Actions, Wear OS / watchOS |
| Health Connect, Apple Health, Strava sync | Later | - | Later | Later | Later | UC-27, J13; the app (or a Strava connection) checks in, source "sync" |
| Scheduled stakeholder updates | Later | Later | - | - | Web only | UC-22, UC-23, J8; chosen goals emailed monthly to outside addresses, with charts and a summary; builds on share links |
| One-to-one view | Later | Later | - | - | Later | UC-26, J12; a person's goals, due and at risk, private notes between 1:1s |
| Templates per person | Later | Later | - | - | Web only | UC-24; apply a template to each member, totals per team |
| Challenges and leaderboard | Later | Later | Later | Later | Later | UC-25, J11; join link, start/end, ranking on a shared metric |
| Accounts without email (kids) | Later | Later | Later | Later | Later | UC-21; created by a parent, PIN sign-in |
| Year in review | Later | Later | Later | Later | Later | UC-34, J14; recap across goals, streaks and cycles |
| Check-in heatmap | - | Later | Later | Later | Later | GitHub-style calendar of check-ins per metric |
| Importers: Viva Goals, Weekdone, Perdoo, Tability | Later | Later | - | - | Web only | UC-32, J10; on top of P-09's preview and mapping |
| Calendar feed (iCal) | Later | Later | - | - | Web only | UC-35, J13; due check-ins and target dates |
| Prometheus / Grafana exporter | Later | - | - | - | Web only | UC-35; goal progress and metric values as series |
| Home Assistant integration | Later | - | - | - | Web only | UC-35, J13; a sensor per goal/metric, a service to check in; next to P-11 |
| n8n / Zapier / Make apps | Later | - | - | - | Web only | Triggers on health change and check-ins, an action to check in; on P-12's webhooks |
| Draft OKRs from a strategy document | Later | - | - | - | Web only | Planning skill: paste a strategy or last cycle's scores, get a draft tree to confirm |
