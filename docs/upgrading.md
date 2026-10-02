# Upgrading

GoalNexa upgrades in place: new code, then `migrate`. Every release can
be reached from the oldest supported one in a single step - CI installs
that release, fills it with data, upgrades it to the current commit on
Postgres and checks the data came through (`scripts/upgrade_test.sh`,
the `upgrade` job in `.github/workflows/ci.yml`).

## Versions

Releases are git tags, `vMAJOR.MINOR.PATCH`, on the public repo's `main`;
[`CHANGELOG.md`](../CHANGELOG.md) says what each one changes and whether
it needs anything from you beyond the steps below.

- **Patch** (`v1.0.1`): fixes; no new settings to look at.
- **Minor** (`v1.1.0`): features; may add migrations and optional
  settings.
- **Major** (`v2.0.0`): something you must act on (a removed setting, a
  changed default). The changelog entry says what.

**Oldest supported release**: the tag (or, before the first tag, the
commit) in [`.github/upgrade-from`](../.github/upgrade-from). From there
or anything newer, upgrade straight to the latest. From something older,
first upgrade to that release, then to the latest.

Downgrading isn't supported: migrations only go forward. To go back,
restore the backup you took before upgrading.

## Before you upgrade

1. Read the changelog entries between your version and the new one.
2. Back up the database:
   - SQLite (the dev compose): stop the backend, copy
     `apps/main/backend/db.sqlite3`.
   - Postgres (`docker-compose.prod.yml`):
     `docker compose -f docker-compose.prod.yml exec db pg_dump -U goalnexa -Fc goalnexa > goalnexa-$(date +%F).dump`
3. Keep your `.env`; compare it with the new `.env.sample` for new keys
   (all optional unless the changelog says otherwise).

## Upgrade

`docker-compose.prod.yml` (built images, Postgres):

```sh
git fetch --tags
git checkout v1.0.0                       # the release you're moving to
git submodule update --init --recursive   # the modules it pins
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d   # the migrate service runs first
```

`docker-compose.yml` (the development compose, SQLite by default):

```sh
git pull && git submodule update --init --recursive
docker compose up -d --force-recreate main-backend main-scheduler main-frontend
docker compose restart nginx              # it resolves the frontend's address once
```

The backend installs its dependencies and runs `migrate` on start.

Docker Swarm (the hosted deployment): `docs/deployment.md` - the deploy
script migrates with the new image before it rolls the services.

## After

- System > Status (as an admin): the scheduler's last run and the latest
  migration.
- Log in, open the dashboard.

If something is wrong: stop the stack, restore the backup
(`pg_restore --clean -U goalnexa -d goalnexa <file>`, or put the SQLite
file back), check out the version you came from, start it again.

## For maintainers

**Releasing**

1. Move the changelog's "Unreleased" entries under a new version heading
   with today's date.
2. Tag the commit on `main` and push the tag: `git tag -a v1.0.0 -m v1.0.0 && git push origin v1.0.0`.
3. The hosted deployment releases separately, from the private fork
   (`docs/deployment.md`).

**Raising the oldest supported release**: put a newer tag in
`.github/upgrade-from` and say so in the changelog (a major version). Do
it when keeping the old upgrade path costs something - until then it
only costs CI time.

**The rule that keeps upgrades safe**: a migration must also work with
the previous release's code (the hosted deployment migrates while the
old version still serves). Add a column - with a database default or
nullable - in one release; rely on it, or drop the old one, in the next.

**Running the upgrade test locally**

```sh
git worktree add /tmp/goalnexa-old "$(cat .github/upgrade-from)"
git -C /tmp/goalnexa-old submodule update --init
scripts/upgrade_test.sh /tmp/goalnexa-old           # scratch SQLite; DATABASE_URL=postgres://... for Postgres
```

It doesn't cover restoring a backup yet - that's roadmap item P-07.
