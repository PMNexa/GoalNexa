# Lifecycle email

Design for the emails GoalNexa sends on its own initiative - onboarding,
habit, team, win-back and (Cloud) upgrade - to move each user one step
along **signup -> first check-in -> weekly habit -> team -> paid**, and
to bring back the ones who drift. Roadmap: P-43..P-47 and C-22
(`docs/roadmap.md`). Status: P-43..P-45 built (foundation, onboarding,
engagement, measurement); C-22, P-46 and P-47 not yet. "As built" below
notes where the code differs from the first design.

Transactional mail (verification, password reset, invitations, check-in
reminders, the digest) already exists and is not changed here, except
that it gains the shared unsubscribe/suppression handling below.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Build or buy (Customer.io, Loops, Brevo marketing) | **Build**, a small engine in platform-core | The outbox, scheduler, settings, console and `last_seen_at` already exist; behavior data stays on our server ("no analytics" on the privacy page); self-hosters get it too. Cost: no visual builder - a journey change is a code change. Revisit if a non-developer runs campaigns. |
| Self-hosted default | **Off** (`lifecycle.enabled`); on in `saas` mode | A self-hoster's users didn't sign up for our marketing. They can turn it on. |
| Weekly digest | **On by default for new users** (existing users unchanged) | The digest is the habit loop that already works; opt-out from the email and My account. |
| Open tracking | **None** - click tracking only | No pixel keeps the privacy promise; Apple Mail Privacy Protection makes open rates meaningless anyway. |
| Language | **English first**; Vietnamese later (P-47) | One set of templates to get right before translating. |

## Strategy

### Principles

- **Behavior-triggered, not calendar blasts.** An email exists because a
  user did, or didn't do, something. Every journey has an exit: reaching
  its goal ends it (the first check-in ends onboarding).
- **One email, one action.** Short, mostly text, one button that lands
  on the exact screen (`/dashboard?goal=<id>`, the check-in form, the
  connect page) - not the home page.
- **Respect the chat path.** Users who connected an assistant (MCP) get
  "say this to Claude: *ran 5 km today*", not "open the website". Many
  of them never open it again (see the agent path in `AGENTS.md`).
- **Restraint.** At most 2 lifecycle emails per user per 7 days, none
  between 21:00 and 08:00 in the user's timezone (the one the digest
  stores; UTC when unknown), and nothing at all after 60 days without
  activity (sunset).
- **Measure the lift, not the opens.** A random 10% holdout per journey
  receives nothing; a step's value is the target action rate within 72h
  versus the holdout.
- **Clean consent.** Account mail (verification, resets, security) is
  always sent. Everything else sits in a category the user can turn off
  in one click. "Product news" is opt-in.

### Categories

| Category | Default | Contains |
|---|---|---|
| Account (not listed) | always | Verification, password reset, security notices |
| Reminders & digest | on | Existing check-in reminders and digest (their own settings stay) |
| Tips & onboarding | on | Journeys 1, 2 (tips), 3 |
| Progress & milestones | on | Journey 2 (milestones), 4 |
| Product news | **off** (opt-in) | Journey 6, broadcasts |
| Offers (Cloud) | on | Journey 5 |

### Journeys

Delays are from the trigger; "+24h" means 24 hours after it, sent at the
next allowed hour.

**1. Onboarding** - enters at signup (after email confirmation when
verification is on); exits at the first check-in.

| Step | When | Condition | Email |
|---|---|---|---|
| welcome | immediately | - | Welcome + one action, by onboarding choice: create a goal (website) or connect an assistant (AI agent) |
| first-goal | +24h | no goal | "Your first goal in 2 minutes" - an example, and the plan prompt for assistants |
| first-check-in | +48h | a goal, no check-in | "Log your first number" - the check-in link, or what to tell the assistant |
| go-mobile | +4d | still no check-in | "Check in from your phone": connect Claude / ChatGPT |
| first-week | +7d | - | A short recap of what they set up, and the one next step |

**2. Habit** - for activated users (at least one check-in).

- Weekly digest on by default for new users (existing feature, P-44 only
  flips the default).
- Milestones: a goal crosses 50%, a goal reaches 100% / is achieved, 4
  weeks in a row with a check-in. Celebrate; offer the share link.
- Feature tips, at most one a week, only for features the user hasn't
  used: reminders, ingest URL, cycles, share link, assistant connect.

**3. Team** - enters after 2 active weeks with no teammate.

- "Track this with your team": invite a teammate (org invitations).
- For org owners whose members haven't checked in for 7 days: a short
  team summary with who's current.
- Exits when the user has an active teammate.

**4. Win-back** - enters when `last_seen_at` is 7 days old; exits when
the user is seen again.

| Step | When | Email |
|---|---|---|
| overdue | 7d | "3 metrics are waiting" (only if some are overdue; else skip) + the chat example |
| still-right | 14d | "Is this goal still right?" - adjust the target or archive it |
| whats-new | 30d | What changed since they left |
| goodbye | 60d | Last email; then the user is sunset (no lifecycle mail until seen again) |

**5. Upgrade** (Cloud, C-22) - plan signals from `goalnexa_billing`.

- At 80% of a plan limit: what's left, what the next plan adds.
- 1h after a `402 plan_limit` refusal: the pricing page (neutral wording,
  like the MCP refusal).
- A Free org with 3+ active members: the Team plan.
- After an upgrade: welcome to the plan, what's now unlocked.
- After a cancellation: one-question survey.

**6. Announcements** - monthly "what's new" broadcast to "Product news"
subscribers (P-46).

### Measures

| Measure | Target to watch |
|---|---|
| Activation: first check-in within 7 days of signup | vs. holdout, per onboarding choice |
| Retention: active in week 1 and week 4 | vs. holdout |
| Per step: click rate, target action within 72h | lift vs. holdout |
| Unsubscribes per send | < 0.5% |
| SES complaints | < 0.1% (SES reviews accounts above that) |
| Hard bounces | < 2% |
| Cloud: free -> paid within 30 days | journey 5 vs. holdout |

## Functions

### Engine (platform-core, `platform_lifecycle`)

1. **Signals.** `record_signal(user_id, name, data=None)`, called where
   the app already writes: `signup`, `email_verified`, `goal_created`,
   `metric_created`, `check_in`, `invite_sent`, `invite_accepted`,
   `mcp_connected`, `plan_limit`, `plan_changed`, `plan_cancelled`.
   Inactivity comes from `last_seen_at` (P-28), not from signals.
2. **Journeys in code.** A module registers `Journey(key, category,
   trigger, steps, exit, holdout=0.1)`; a step is `Step(key, delay,
   condition, template, target)`. Conditions and exits are functions of
   the user (queries), so they reflect the current state, not stale
   events. Versioned and tested like any code.
3. **Scheduler.** `run_lifecycle_jobs()`, called from `goalnexa_jobs`
   every run (5 min): enroll from new signals, exit enrollments whose
   exit holds, send due steps. A step is claimed with a conditional
   UPDATE (like reminders), so two schedulers never send it twice.
4. **Guards**, in order: user active and not sunset -> not in the
   holdout -> category on -> address not suppressed -> frequency cap ->
   quiet hours (reschedule, don't drop) -> condition still true (else
   skip the step).
5. **Templates.** As built: a step's `render(ctx)` returns a `Message`
   (subject, short paragraphs, one button, lines after it) or None to skip
   - Python next to the step's condition, not template files. One shared
   layout (`platform_lifecycle/layout.py`) makes the text and HTML; the
   outbox adds the footer (why it came, unsubscribe link, the
   `email.postal_address` setting) to every categorized email.
6. **Sending** through the outbox (retries, delivery log) with
   `kind="lifecycle:<journey>.<step>"`. `send_email` gained `category=`
   (preference check, unsubscribe headers and footer) and `headers=`;
   every message carries `X-SES-CONFIGURATION-SET` when
   `email.ses_configuration_set` is set. The check-in reminder and digest
   emails go under "Reminders & digest".
7. **Unsubscribe.** Every non-account email carries `List-Unsubscribe:
   <https://.../api/v1/email/unsubscribe/<token>>` and
   `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (Gmail/Yahoo
   bulk-sender rule), plus a footer link to a no-login page with every
   category. The token is signed (`django.core.signing`, like
   platform-auth's links), carries user and category, no table.
8. **Bounces and complaints.** An SES configuration set publishes to
   SNS, which POSTs to `/api/v1/email/ses-events` (SNS signature
   verified, subscription confirmed automatically). Hard bounce or
   complaint -> `Suppression`; every send - transactional too - checks
   it. Counts on Status (closes C-01's "bounces visible on Status").
9. **Click tracking.** Links go through `/api/v1/l/<signed>` -> 302 to the
   target with `utm_source=email&utm_campaign=<journey>.<step>`; the
   click is stamped on the `Send`. No open pixel.
10. **Attribution** (P-45). A step names its target (e.g. `check_in`);
    a matching signal within 72h of the send stamps `converted_at`. The
    holdout's enrollments record the same "would have sent" moment, so
    both sides are comparable.

### System console (`/system/lifecycle`)

- Journeys: on/off, per step sent / clicked / converted / unsubscribed,
  and the holdout's conversion beside it.
- Template preview with a chosen user's data; "Send a test to me".
- Suppression list: view, remove (with a reason, audited).
- On a user's page: the lifecycle messages they got, and their category
  settings.
- Broadcasts (P-46): compose, pick a segment (category + simple filters),
  preview, schedule.

### User side

- My account > **Email preferences**: the categories above.
- The unsubscribe page: works signed out, one switch per category,
  "unsubscribe from everything except account mail".

### Cloud (`goalnexa-cloud`, C-22)

- The upgrade journey, its conditions (plan, usage vs. limits) and the
  "Offers" category, registered from the billing extension.
- Signals from `goalnexa_billing`: `plan_limit` (402), `plan_changed`,
  `plan_cancelled` (Paddle webhooks).

## Architecture

```
 app writes (signup, check-in, goal, invite, 402, plan change)
      | record_signal(user_id, name, data)            last_seen_at (P-28)
      v                                                      |
 +--------------- platform_lifecycle (platform-core) --------+-------+
 | Signal --> Enrollment(user, journey, step, next_at, status)        |
 |               ^  journeys registered by modules:                   |
 |               |    goalnexa/lifecycle.py  (onboarding, habit,      |
 |               |                            team, win-back)         |
 |               |    goalnexa_billing       (upgrade - Cloud only)   |
 | goalnexa_jobs + every 5 min: due steps -> guards -> render         |
 | Send(enrollment, step, email, holdout, clicked_at, converted_at)   |
 | EmailPreference(user, category, on)   Suppression(email, reason)   |
 +-------------------------------+------------------------------------+
                                 v
          send_email(headers=...) -> OutgoingEmail outbox (exists)
                                 v
       SES :2587 + configuration set --> SNS --> POST /api/v1/email/ses-events
                                 |                (bounce/complaint -> Suppression)
                                 v
                              inbox -- click --> /api/v1/l/<signed> -> 302 + UTM
```

### Data model

| Model | Fields | Notes |
|---|---|---|
| `Signal` | id, user_id, name, data (JSON), at | Append-only; kept 90 days (P-04's retention job) |
| `Enrollment` | id, user_id, journey, key, data, status (active / done / exited), step, next_at, holdout, entered_at, ended_at, exit_reason | One per (user, journey, key) ever - `key` tells repeatable entries apart (a goal's milestone, one spell of inactivity); sunset is an exit reason |
| `LifecycleSend` | id, enrollment, user_id, journey, step, subject, email (FK `OutgoingEmail`, null for holdout), holdout, target, sent_at, clicked_at, converted_at, unsubscribed_at | Unique (enrollment, step) - the idempotency guard |
| `EmailPreference` | user_id, category, enabled, updated_at | Missing row = the category's default |
| `Suppression` | email, reason (bounce / complaint / manual), source, created_at | Checked by every send, transactional included |

Bare `user_id`s like the rest of the platform; `user_removed` deletes a
user's rows, and the export provider includes them.

### Placement

- **platform-core**: `core_api.lifecycle` (the facade: `Journey`,
  `Step`, `Message`, `record_signal`, `on_signal`), `platform_lifecycle`
  (Signal, Enrollment, LifecycleSend, the engine, clicks, the console
  API). As built, what applies to all mail lives in `platform_system`:
  `EmailPreference`, `Suppression`, the categories
  (`core_api.system.EmailCategory`), unsubscribe and SES endpoints.
  Frontend: the preferences page, the unsubscribe page, System >
  Lifecycle email, the panel on a user's console page.
- **goalnexa** `goalnexa/lifecycle.py`: the categories, signals at its
  write points (`activity.record`, `refresh_goal`), the onboarding /
  tips / milestones / win-back journeys, the weekly-digest default.
- **The host** `config/lifecycle.py`: `signup` and `invite_sent` from
  `post_save` on platform-auth's User and platform-org's invitation (so
  neither module changes), and the team journeys, which join orgs, goals
  and activity. The recipient lookup is `config/user_directory.py`'s
  `lifecycle_users` (`PLATFORM_LIFECYCLE_USERS`).
- **goalnexa-cloud** billing extension: the upgrade journey and plan
  signals (C-22).
- **Settings**: `lifecycle.enabled` (`LIFECYCLE_ENABLED`; default off,
  `saas` on), `lifecycle.frequency_cap` (2 per 7 days),
  `lifecycle.quiet_start` / `quiet_end` (21 / 8), `lifecycle.holdout_percent`
  (10), `lifecycle.sunset_days` (60), `email.ses_configuration_set`,
  `email.ses_topic_arns` (only these SNS topics are accepted),
  `email.postal_address` (footer), `retention.lifecycle_signals_days` (90).
  Links need `PUBLIC_URL` (main: `GOALNEXA_PUBLIC_URL`).

### Deliverability

- Domain already verified in SES (DKIM, custom MAIL FROM, DMARC
  `p=none`); move DMARC to `quarantine` once mail is steady.
- One-click unsubscribe headers on every non-account email.
- Suppression shared by all mail, so a bounced address isn't retried by
  the next journey.
- Before volume grows: lifecycle and broadcasts from their own sending
  subdomain (e.g. `news.goalnexa.binhnguyen.org`) and configuration set,
  so a complaint spike can't hurt password resets (P-46).

### Privacy

- No third party sees behavior data; SES sees recipients and content
  only, as it does for transactional mail.
- No open pixel; clicks are first-party redirects.
- Privacy page: add lifecycle email, categories and how to opt out
  (Cloud's `privacy.tsx`), before P-43 ships in Cloud.

### Testing

- Unit: each journey's steps, conditions, exits, guards (cap, quiet
  hours across timezones, holdout, suppression), idempotent claiming.
- Integration: a signed-up test user walked through onboarding with a
  frozen clock; unsubscribe link and one-click POST; an SNS bounce
  notification suppressing an address.
- Tenant isolation: the unsubscribe and click tokens can't be forged or
  used for another user (`apps/main/backend/tests/`).

## Phases

| Phase | Roadmap | Scope |
|---|---|---|
| 1. Foundation + onboarding | P-43 | Preferences, unsubscribe, SES suppression + bounces on Status, engine, guards, holdout, onboarding journey, console per-step counts |
| 2. Engagement | P-44 | Habit (milestones, tips, digest default), team, win-back + sunset |
| 3. Measurement | P-45 | Conversion attribution vs. holdout, per-user timeline |
| 4. Upgrade | C-22 | Cloud upgrade journey + "Offers" |
| 5. Broadcasts | P-46 | Newsletter composer, "Product news" opt-in, separate sending subdomain |
| 6. Languages | P-47 | Templates per language, Vietnamese first |
