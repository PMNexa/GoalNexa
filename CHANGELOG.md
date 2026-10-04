# Changelog

What changed in each release, newest first. How to upgrade:
[`docs/upgrading.md`](docs/upgrading.md). Versions are git tags
(`vMAJOR.MINOR.PATCH`); an entry marked **Action needed** asks something
of you beyond the usual upgrade steps.

## Unreleased

### Added

- **Ready for the ChatGPT app directory.** Every MCP tool states
  `openWorldHint` too (true for every write - what it changes is
  shared with an organization's members - `MCP_TOOL_ANNOTATIONS` corrects a
  resource tool's hints), and `MCP_OPENAI_APPS_CHALLENGE` serves OpenAI's
  domain-verification token at `/.well-known/openai-apps-challenge`
  (unset = 404). If you run your own nginx config, route that path to the
  backend like `/.well-known/oauth-*`.
- **Account lockout.** An account locks for 15 minutes after 10 wrong
  passwords in a row (System > Settings: "Lock an account after failed
  logins", "Lock it for"; 0 attempts = never). The owner gets an email;
  a password reset or an admin's Unlock on the user's page ends it
  sooner. Locks are in the audit log.
- **Password rules.** New passwords - signup, reset, change - must meet a
  minimum length (a setting, default 8) and may not be one of the 20,000
  most common ones (a setting, on by default). Existing passwords keep
  working.
- **Single sign-on (OpenID Connect).** "Sign in with ..." for a
  provider - Google, Authentik, Keycloak, Microsoft Entra ID, ... - set
  with `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`; more than
  one (a button each, with Google's and Microsoft's logos) with
  `OIDC_PROVIDERS`. Links to an
  existing account by verified email; new people get an account under
  the same signup policy as the signup form. "Allow email + password
  login" can be turned off to make it the only way in. See
  [`docs/sso.md`](docs/sso.md).
- **Use it from your AI assistant, without the website.** What a
  connected assistant needs to do the whole job by chat:
  - The MCP server now tells the assistant how to plan a goal, log a
    check-in and review progress, so a client with only the connection -
    no skills installed - answers with progress, days left and next
    steps, in the language you write in.
  - Replies end with a link that opens the dashboard on that goal
    (`/dashboard?goal=<id>`).
  - New tools: `goals_chart` (a goal's readings over time, to draw or
    summarize) and `reminder_settings_get` / `_update` / `_test` (set up
    reminders and the digest by chat).
  - The skills offer to set up reminders and to invite teammates.
  - Connecting an assistant with no account yet: sign up, confirm your
    email, and you're back on the "Allow" page instead of the dashboard.
  - Status shows who logged check-ins over 7 and 30 days: web, AI agent
    or ingest, with shares.
  - Someone who started by chat and has goals but no organization gets
    the dashboard, not the onboarding wizard.
- **Upgrade test.** CI upgrades an install of the oldest supported
  release, with data, to every commit (`scripts/upgrade_test.sh`).
  `docs/upgrading.md` documents versions and the upgrade steps.

### Upgrade notes

- New migration: `platform_auth.0005_lockout_sso` (two columns on the
  user table, one new table). Nothing to do beyond the usual steps.
- New optional `.env` keys: `OIDC_*`, `AUTH_PASSWORD_LOGIN`,
  `AUTH_LOCKOUT_ATTEMPTS`, `AUTH_LOCKOUT_MINUTES`,
  `AUTH_PASSWORD_MIN_LENGTH`, `AUTH_PASSWORD_REJECT_COMMON`.
- Lockout is on by default after upgrading (10 attempts, 15 minutes).
- **Action needed if you administer users or roles through an AI
  client:** MCP now exposes goal tracking only (organizations, members,
  invitations, goals, metrics, check-ins, cycles, comments, activity).
  Set `MCP_RESOURCES=*` in `.env` to get every resource back.
- New optional `.env` key: `MCP_RESOURCES`.

## Before the changelog

Everything up to commit `6bdf9bc5` (2026-10-01): goals, metrics and
check-ins, the dashboard, schedules and reminders, ingest URLs, cycles,
digests, the activity feed and comments, organizations and roles, the MCP
server and agent skills, and system administration. That commit is the
oldest supported release to upgrade from until `v1.0.0` is tagged.
