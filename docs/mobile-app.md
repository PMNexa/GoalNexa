# Mobile app: native Android, then iOS

Design for GoalNexa's phone apps. Roadmap: P-67..P-79
(`docs/roadmap.md`). Status: proposed (2026-10-16); the server side
(P-67..P-72) built 2026-10-16 - "As built" at the end.

## What the app is for

Phone use is short and frequent. The app does three jobs, faster than
typing a sentence to an assistant:

1. **Check in** - "ran 5 km" logged in a few taps.
2. **Glance** - what's due, what's at risk, this period's quota.
3. **Act on a nudge** - a reminder arrives, tap, check in, done.

Setting things up stays on the web: templates, the team board, closing a
cycle, the system console. The app links out to the web for those.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Technology | **Fully native**: Kotlin + Jetpack Compose, later Swift + SwiftUI | Asked for. Widgets, shortcuts and push are first-class |
| Order | **Android first**; iOS once the API has settled | Asked for |
| Where the logic lives | **Thin client**: the server computes every %, health, pace, projection and chart series; the app only shows them | `goalnexa/progress.py` and `lib/progress.ts` already have to be kept in step - a Kotlin and a Swift copy would make four |
| API client | Generated from the OpenAPI document (`/api/v1/schema`) | A breaking API change fails the app's build, not the app in users' hands |
| Self-hosted servers | Supported from v1: sign-in screen has a server URL (hosted by default) | Self-hosters are half the audience |
| Push | Through a **push relay** we run, **free for every server, self-hosted included** | FCM/APNs keys belong to our app; a self-hosted server can't use them without a relay |
| Health / fitness sync | Out of scope | Decided |
| Package name | `com.goalnexa.app` | Permanent once on Play |
| Play account | Personal | New personal accounts need a closed test (12 testers, 14 days) before production - planned into P-76 |
| v1 notifications | Check-in due, period quota short, digest | The jobs that already exist (`reminders`, `short_of_quota`, `digest`) |
| v2 notifications | Comments on your goals, a goal's health changing - opt-in | From `Activity`; noisy if on by default |
| UnifiedPush | v2, Android only | De-Googled phones and ntfy users push straight from their own server, no relay |

## Where the source code lives

| What | Where | Why |
|---|---|---|
| Android app | `apps/android/` - a plain directory in this public repo (like `apps/main`), not a submodule | The app and the API it calls change in the same PR, and CI checks the app against the same commit's schema |
| iOS app (later) | `apps/ios/`, same rules | |
| Push relay + server half | `apps/platform-push/` - a new submodule (`PMNexa/platform-push`), packaged like the other `platform-*` modules | Generic, not goal-specific; one Django app with two roles (relay, client) |
| API snapshot | `apps/android/api/openapi.yaml`, committed, written by a script from the backend | The Kotlin client is generated from it at build time (OpenAPI Generator Gradle plugin) and never committed. CI regenerates the snapshot and fails if it differs |
| License | PolyForm Shield like everything else; the repo's `LICENSE` covers the app | |
| Signing and service keys | **Never in either repo's files** - CI secrets of `goalnexa-cloud` only: the Play **upload** key, the Play service account JSON, the production `google-services.json` | Play App Signing keeps the real signing key at Google, so a lost upload key can be reset |
| Store listing text, screenshots | `apps/android/fastlane/metadata/` | Reviewed like code |
| Releases | Built **only in `goalnexa-cloud`**, the same rule as server deploys: a tag `android-v<x.y.z>` there builds the AAB and uploads it to Play's internal track (Fastlane) | Secrets live there; the public repo never publishes |

A build from the public source works without our secrets: debug builds
have push turned off unless the builder supplies their own
`google-services.json` (and then their own relay - documented in
`apps/android/README.md`).

Public CI builds and tests the app on an Ubuntu runner, only when
`apps/android/**` or the API snapshot changes (path filter). `apps/ios/`
will need a macOS runner (free on a public repo).

## Android stack

Kotlin, Jetpack Compose + Material 3, Hilt, Retrofit/OkHttp with the
generated client, kotlinx.serialization, DataStore + Android Keystore for
tokens, Room + WorkManager (offline queue, v2), Glance (widget, v2), FCM.
minSdk 26 (Android 8), targetSdk follows Play's yearly rule.
Notifications permission (Android 13+) is asked in context ("Remind me
when check-ins are due?"), not at first launch.

## v1 screens

1. **Sign in** - email/password or SSO; "Use your own server" link.
2. **Today** - due metrics, this period's quota per metric ("6/10 km
   today - 4 to go", from `pace`), goals at risk. One call: `GET today`.
3. **Check in** - number pad with the unit, optional note, backdate. Says
   what it replaces (`replaces`) and the period it went to (`snap_to`).
4. **Goals** and **goal detail** - %, health badge, projection, one chart
   per metric (server-drawn series), activity feed.
5. **Settings** - organization switch, notifications, sign out, delete
   account (Play requires in-app deletion).

## Backend changes (public repo, useful beyond mobile)

| Item | Change |
|---|---|
| Native sign-in (P-67) | Login and refresh accept `client: "native"` and return the refresh token in the body instead of the cookie (`RefreshView` reads only `request.COOKIES` today); single-use rotation unchanged; each device is a session listed under "sign out everywhere" (`SessionProvider`) |
| SSO for apps (P-68) | `auth/sso/start?app=1` with PKCE; the callback redirects to `goalnexa://auth/sso?code=...`, a one-time code the app exchanges for tokens. Opened in a Custom Tab |
| Idempotent check-ins (P-69) | `CheckIn.client_ref`, unique per author: a retried request returns the first check-in. `source = "mobile"` (attribution, Status page) |
| Today (P-70) | `GET today`, scoped like every list (`as_user`) |
| Chart payload (P-71) | Each metric's replayed series and projection, ready to draw (what `lib/progress.ts` computes in the browser today) |
| App versions (P-72) | `auth/config` carries `min_app_version`; the app asks to update below it. Rule: the API keeps working for app versions released in the last 6 months - an addition is fine, a removal or rename needs a new field first |

Every new endpoint goes into `tests/` tenant isolation and the OpenAPI
test; `PushDevice` gets a `user_removed` receiver and a retention rule.

## Push relay (P-73, P-74)

The relay must not become a free spam cannon for whoever finds it.

1. **The server never sees the FCM token.** The app registers with the
   relay itself and gets a **handle** bound to the one server URL the
   user signed in to. The app gives the handle to its server
   (`PushDevice`). A server can only push to devices whose users chose it.
2. **No content goes through the relay.** A push carries a kind
   (`checkin_due`, `quota_short`, `digest`) and an id. The app wakes,
   fetches the details from its own server with its own token, and builds
   the notification on the phone. The relay never sees goal names or
   numbers.
3. **Servers sign their requests** with a key created on first use - no
   sign-up.
4. **Rate limits** per server and per handle (start: 50 a day per
   device).
5. **Revoked** on sign-out; pruned when FCM reports the token dead.
6. **One path for all**: the hosted server uses the relay too.
7. Where reminders go becomes a choice in `ReminderSettings`: Apprise,
   push, or both.

The relay runs on the hosted deployment at its own subdomain, so it can
be moved or scaled on its own. FCM is free; the cost is one small
service.

## Releases (P-76)

- Versions: `versionName` from the tag, `versionCode` increasing per
  release.
- Play: internal track -> closed test (12+ testers, 14 days, required for
  a new personal account) -> production. Data safety form: account data,
  goals and check-ins sent to the user's chosen server; push carries no
  content.
- Review needs a demo account on the hosted server.

## Risks

- **Auth on a device** - token storage, PKCE, rotation races
  (`refreshSession`'s dedupe has to exist in the app too).
- **Old app versions** in the wild - the compatibility rule above, tested.
- **The relay** - abuse and availability; every self-hosted push depends
  on it.
- **Two native codebases** for one maintainer - the thin client keeps
  them to screens.

## As built (P-67..P-72)

- **Native sessions**: `"client": "native"` (+ `"device_name"`) on
  login, signup, setup or a password change -> `refresh_token` and
  `refresh_expires_in` in the body, no cookie. `refresh` and `logout`
  take `{"refresh_token"}`. `RefreshToken.client`/`device_name` survive
  rotation, so refresh needs no `client`. Shown on the admin's session
  list and in the account export.
- **SSO for apps**: `GET auth/sso/start?provider=&app_redirect=goalnexa://auth/sso&code_challenge=<S256>&device_name=`
  -> provider -> `goalnexa://auth/sso?code=` (or `?error=<code>`) ->
  `POST auth/sso/token {code, code_verifier}` -> native session. An
  address not in `PLATFORM_AUTH_APP_REDIRECTS` is a 400; a missing
  challenge goes back to the app as `error=invalid_request`. Codes: SHA-256
  stored, 2 minutes, once; a wrong verifier doesn't spend one.
- **Check-ins**: `client_ref` (max 64 chars, unique per author, set at
  create only): a repeat answers 200 with the first check-in, a repeat on
  another metric 409. `X-GoalNexa-Client: mobile` -> `source: "mobile"`.
  Bulk check-ins ignore `client_ref`.
- **`GET /api/v1/today`** (`?org=<id>|personal`): `due` (oldest due
  first), `periods` (with `pace`), `at_risk` (lowest progress first), up
  to 50 each, `due_total`, `now`. Only metrics the caller may check in on.
- **`GET goals/<id>/chart`**: metrics by `position`, each with `parent`,
  `tracked`, `target_per`, `projection` (`{at, value, progress}` - a
  period metric's is its pace, `value` null) and the payload's `range`
  (`start` = first metric or reading, `end` = later of now and the target
  date).
- **`min_app_version`** in `GET auth/config`: `{android, ios}` from the
  settings `apps.min_android_version` / `apps.min_ios_version` (env
  `APPS_MIN_ANDROID_VERSION` / `APPS_MIN_IOS_VERSION`), "" = any.

Tests: `apps/main/backend/tests/test_mobile.py`.
