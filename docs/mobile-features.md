# Mobile app features

The feature list of the GoalNexa phone apps, tracked per platform. The
apps' source is private - `goalnexa-cloud`'s `apps/android/`, later
`apps/ios/`, never this repo;
the design is `docs/mobile-app.md`, every product feature and whether it
comes to the apps is `docs/feature-map.md`, the roadmap items P-67..P-79 are in
`docs/roadmap.md`. Update a row with the PR that changes the feature (an
app change in `goalnexa-cloud` updates it with a PR here).

The apps are thin clients: the **Server** column is the API the feature
needs (in this repo, released to production), the app columns are
the screens. A feature ships on both platforms; iOS follows Android
(P-79).

Status: **Done** - built and tried on a device · **Built** - built, not
yet tried on a device · **Partial** - part of it works (see notes) ·
**Planned** - on the roadmap · **Later** - wanted, no roadmap item yet ·
**n/a** - not needed on that side.

Last updated: 2026-10-22.

## Sign-in and account

| Feature | Server | Android | iOS | Item | Notes |
|---|---|---|---|---|---|
| Email + password sign-in (native session) | Done | Done | Planned | P-67, P-75 | Refresh token in the body; encrypted with an Android Keystore key |
| Single sign-on (Google, any OIDC) | Done | Built | Planned | P-68, P-75 | Custom Tab + PKCE back to `goalnexa://auth/sso`; untested against a real provider |
| Hosted server by default, or your own server's address | Done | Done | Planned | P-75 | Release builds are HTTPS only |
| Stay signed in (token refresh, serialized) | Done | Built | Planned | P-67, P-75 | The refresh token is single use - two refreshes must never race |
| Device shown in the session list ("App on <device>") | Done | Built | Planned | P-67 | Device name from the phone's settings |
| Sign out (revokes the session) | Done | Done | Planned | P-75 | |
| Delete account in the app | Partial | Built | Planned | P-75 | Asks for the password; an SSO-made account sets one first ("Forgot password" on the web). On a server with password sign-in off, such an account can't delete itself anywhere yet - server gap. Required by both stores |
| "Update the app" when older than `min_app_version` | Done | Built | Planned | P-72, P-75 | |
| Sign up in the app | Done | Done | Planned | P-75 | Native session (`ref=android`); a server that confirms emails shows "Check your email" with a resend; a field's own error ("Use at least 8 characters."); the hosted service's Terms and Privacy linked |
| Forgot password | Done | Done | Planned | P-75 | `POST auth/password/forgot`; the link opens the web's reset page, then sign in in the app |
| Unconfirmed email at sign-in | Done | Done | Planned | P-75 | `email_unverified`: says so and offers another link |

## Today

| Feature | Server | Android | iOS | Item | Notes |
|---|---|---|---|---|---|
| Metrics due for a check-in | Done | Done | Planned | P-70, P-75 | Oldest due first; count shown past 50 |
| This period's quotas with pace ("6/10 km today - 4 to go") | Done | Built | Planned | P-70, P-75 | Text and bar from the server's `pace` |
| Goals at risk / off track | Done | Done | Planned | P-70, P-75 | Opens the goal |
| Pull to refresh | n/a | Built | Planned | P-75 | |
| Organization / personal filter | Done | Done | Planned | P-75 | `GET today?org=<id>\|personal`; the same switch on Today and Goals |

## Goals

| Feature | Server | Android | iOS | Item | Notes |
|---|---|---|---|---|---|
| Goal list with %, projection, target date, health | Done | Done | Planned | P-75 | Archived goals left out |
| Goal page: metrics with reading, % and pace | Done | Done | Planned | P-75 | |
| Sub-goals and sub-metrics as a tree | Done | Done | Planned | P-75 | Goals tab and a goal's metrics are trees; a goal page lists its sub-goals |
| Charts per metric (progress over time, projection) | Done | Done | Planned | P-71, P-75 | Server series (`goals/<id>/chart`), drawn on a Canvas: now, target date, dashed projection |
| Tracked-only metrics (value, no %) | Done | Built | Planned | P-75 | Value shown; its chart is in its unit |
| Activity feed and comments | Done | Built | Planned | P-75 | Feed tried on a device; write a comment and delete your own (not yet tried on a device); names from the org's members |
| Open on the web (templates, team board, cycles, admin) | Done | Built | Planned | P-75 | Setup stays on the web |
| Team totals (read-only) | Done | Done | Planned | P-75 | Labeled "Team total · read-only", no Check in |
| Create a goal | Done | Done | Planned | P-75 | Title, why, target date, personal or an organization's; from Goals' "New goal" and the first-goal prompt on Today and Goals |
| Edit a goal, complete / reopen, archive, delete | Done | Done | Planned | P-75 | The goal page's menu; delete takes its metrics, check-ins and sub-goals |
| Add a sub-goal | Done | Done | Planned | P-75 | Stays in its parent's organization |
| Add, edit, delete a metric (and sub-metrics) | Done | Done | Planned | P-75 | Name, unit, start -> target, new value or amount done, a target per day/week/month, check-in schedule |
| Metric page: every check-in, edit or delete one | Done | Done | Planned | P-75 | Who logged it and from where; a replaced one struck through; team totals' rows read-only |
| Templates' goals and team totals stay read-only | Done | Done | Planned | P-75 | No menu: their shape is set on the website |

## Check in

| Feature | Server | Android | iOS | Item | Notes |
|---|---|---|---|---|---|
| Check in: number with unit, optional note | Done | Done | Planned | P-75 | Label follows the metric: amount done, total so far this period, or new value |
| No duplicates on retry (`client_ref`) | Done | Built | Planned | P-69, P-75 | One reference per open sheet |
| Attributed to the phone app (source "mobile") | Done | Done | Planned | P-69 | `X-GoalNexa-Client: mobile` on every request |
| Says what it replaced (one reading per period) | Done | Built | Planned | P-75 | From the response's `replaces` |
| Backdate (pick the date and time) | Done | Done | Planned | P-75 | No future dates |
| Says which period it went to (`snap_to`) | Done | Done | Planned | P-75 | "for the week of Oct 5", in the phone's time zone |
| Check in from a notification | Planned | Planned | Planned | P-74 | |

## Organizations

| Feature | Server | Android | iOS | Item | Notes |
|---|---|---|---|---|---|
| Switch organization / personal goals | Done | Done | Planned | P-75 | Kept per server; hidden with no organization |
| Organization and team tags on goals | Done | Done | Planned | P-75 | In "All goals": the organization's name on each goal card, metric row and goal at risk; a team's name always (a template's goals share one title); on a goal's page, always both. Names from `GET orgs` and `GET teams`; Today reads `org_id`/`team_id` from `GET today` |
| Accept an organization invitation | Done | Done | Planned | P-75 | Open invitations to your email on Today (`org-invitations/received`), Join or Decline; the organization's goals and switch appear at once |

## Notifications

| Feature | Server | Android | iOS | Item | Notes |
|---|---|---|---|---|---|
| Push relay (free, self-hosted servers too, no content) | Built | n/a | n/a | P-73 | Runs from `goalnexa-cloud`; the server half is here (`goalnexa/push.py`: signed sends, `push-devices`, `push/messages`) |
| Register the device with the relay | Built | Built | Planned | P-73, P-74 | FCM on Android, APNs on iOS; per server, again on a new token or server key; deleted and revoked on sign-out or switch-off. Needs `google-services.json` in the build |
| Check-in due | Built | Built | Planned | P-74 | Text fetched from `push/messages/<id>`; "Check-ins due" if that fails |
| Period quota short | Built | Built | Planned | P-74 | Same channel as check-ins due |
| Digest | Built | Built | Planned | P-74 | Own channel; nothing shown if the fetch fails |
| Choose push, Apprise or both | Built | Built | Planned | P-74 | `ReminderSettings.push`, next to Apprise and email; the website's Reminders page has the switch |
| Permission asked in context, not at first launch | n/a | Built | Planned | P-74 | Android 13+, iOS. Today's card (Turn on / Not now) and a Settings switch |
| Comments on your goals, health changes (opt-in) | Planned | Planned | Planned | P-78 | |
| UnifiedPush (no Google, no relay) | Planned | Planned | n/a | P-78 | Android only |

## Home screen and offline

| Feature | Server | Android | iOS | Item | Notes |
|---|---|---|---|---|---|
| Widget: today's quotas, tap to check in | Done | Planned | Planned | P-77 | Glance on Android, WidgetKit on iOS |
| App shortcuts (long-press: check in on a metric) | n/a | Planned | Planned | P-77 | |
| Check-ins queued offline, sent later | Done | Planned | Planned | P-77 | `client_ref` makes the resend safe |

## Platform and quality

| Feature | Server | Android | iOS | Item | Notes |
|---|---|---|---|---|---|
| API client generated from the OpenAPI snapshot | Partial | Planned | Planned | P-75 | Auth and `today` need typed schemas first; CI fails on snapshot drift |
| CI: build and unit tests | n/a | Built | Planned | P-75 | `android-ci.yml`: tests, build, lint (Ubuntu); macOS for iOS |
| Unit tests | n/a | Partial | Planned | P-75 | API client, PKCE, versions, feed text, periods, trees; no UI tests |
| Light and dark theme | n/a | Done | Planned | P-75 | GoalNexa's own colors (not the wallpaper's), cards, progress rings; tried on an emulator |
| Translations | n/a | Later | Later | | English only |
| Accessibility pass (TalkBack / VoiceOver, font scaling) | n/a | Later | Later | | |

## Release

| Feature | Server | Android | iOS | Item | Notes |
|---|---|---|---|---|---|
| Release build from a tag (`android-v<x.y.z>` / `ios-v<x.y.z>`) | n/a | Done | Planned | P-76, P-79 | `android-release.yml`: signed .aab on a GitHub release, uploaded to Play's internal track as a draft (`PLAY_SERVICE_ACCOUNT_JSON`). Signing keys are CI secrets only |
| Store listing, screenshots | n/a | Done | Planned | P-76, P-79 | `apps/android/play/` |
| Closed test (Play: 12 testers, 14 days) / TestFlight | n/a | Done | Planned | P-76, P-79 | Required for a new personal Play account |
| Privacy forms (Play Data safety, App Store privacy labels) | n/a | Done | Planned | P-76, P-79 | |
| Demo account for store review | Planned | Planned | Planned | P-76 | On the hosted server |
| Public release | n/a | Done | Planned | P-76, P-79 | On Google Play; the landing page links it |
