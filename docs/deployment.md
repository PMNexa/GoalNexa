# Deploying to DigitalOcean (Docker Swarm)

How production runs: one or more Droplets in a Docker Swarm
(`docker-stack.yml`), a managed Postgres, images in DigitalOcean's
container registry, Caddy terminating HTTPS. Merging a PR into the `deploy`
branch builds and rolls out the new version
(`.github/workflows/deploy.yml` → `scripts/deploy.sh`).

**All of this runs in the private `PMNexa/goalnexa-cloud` repo**, which
merges this public repo daily ("Sync from public repo"). The `deploy`
branch, the `production` environment, the variables and the secrets
live there; this public repo has no `deploy` branch, and its copy of
`deploy.yml` skips itself (no variables).

```
DNS A record → manager Droplet, ports 80/443
Droplet(s) ── Swarm: caddy (HTTPS, Let's Encrypt) → nginx ×2
                     → main-backend ×2, main-frontend ×2
   │  VPC private network
Managed Postgres ── data + auth rate-limit cache
Container Registry ← GitHub Actions pushes images tagged with the commit
```

Replace `<...>` placeholders with your values. Use the same region for
everything.

## 1. Container registry

1. DigitalOcean → **Container Registry → Create**. The name is global
   across DigitalOcean - `goalnexa` if free, else e.g. `goalnexa-<you>`.
2. **Starter (free)** is enough: 1 repository, 500 MB. Both images go in
   one repository, `goalnexa`, as `backend-<commit>` and
   `frontend-<commit>`. After each rollout the workflow deletes every
   release except the one running and the previous one (the rollback
   target), then starts garbage collection, which takes about 10 minutes
   and makes the registry read-only meanwhile - a deploy started during
   it waits. So two releases are stored between deploys. Moving to Basic
   ($5, 5 GB) later needs no change; set the repo variable
   `KEEP_RELEASES` (e.g. `5`) to keep more rollback targets.
3. The registry is `registry.digitalocean.com/<registry-name>` - that's
   `REGISTRY` below.

## 2. API token for CI

**API → Generate New Token**, name `goalnexa-ci`, custom scopes:
**registry: create, read, update, delete** (delete is for the cleanup).
Keep it for step 7.

## 3. Droplet

1. **Create Droplet**: Ubuntu 24.04, 2 GB / 1 vCPU, your region, default
   VPC, your SSH key, **Monitoring** on.
2. Note its public IP and private (VPC) IP.
3. Make the CI deploy key and run the setup script as root (Docker,
   2 GB swap, a `deploy` user in the docker group with that key, Swarm
   init on the private IP - `scripts/droplet-setup.sh`, safe to re-run):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/goalnexa_deploy -N "" -C goalnexa-ci
ssh root@<public-ip> "bash -s -- '$(cat ~/.ssh/goalnexa_deploy.pub)' <private-ip>" < scripts/droplet-setup.sh
```

## 4. Check the deploy login

```bash
ssh -i ~/.ssh/goalnexa_deploy deploy@<public-ip> docker node ls   # lists the Swarm node
```

## 5. Managed Postgres

1. **Databases → Create**: PostgreSQL 17, 1 GB, same region and VPC.
2. **Settings → Trusted sources**: only the Droplet.
3. **Users & Databases**: add user `goalnexa` and database `goalnexa`.
4. Make that user the database owner - on PostgreSQL 15+ a non-owner
   can't create tables, so migrations would fail. From the Droplet
   (a trusted source), with the doadmin **VPC network** connection
   string from the DB's Connection details:

   ```bash
   docker run --rm postgres:17-alpine psql "<doadmin private URI>" -c 'ALTER DATABASE goalnexa OWNER TO goalnexa'
   ```

5. `DATABASE_URL` = the **VPC** connection string with user and database
   `goalnexa`, ending in `?sslmode=require`.

## 6. `.env.production`

In the repo root (gitignored). Generate each secret with
`python3 -c "import secrets; print(secrets.token_urlsafe(50))"`.

```ini
DJANGO_SECRET_KEY=<random 1>
JWT_SECRET=<random 2>
DOMAIN=<app.yourdomain.com>
DJANGO_ALLOWED_HOSTS=<app.yourdomain.com>
DJANGO_CSRF_TRUSTED_ORIGINS=https://<app.yourdomain.com>
DJANGO_HSTS_SECONDS=0
DATABASE_URL=postgresql://goalnexa:<pw>@<private-db-host>:25060/goalnexa?sslmode=require
TRUSTED_PROXY_COUNT=2
DEPLOYMENT_MODE=self_hosted
WEB_CONCURRENCY=3
BACKEND_REPLICAS=2
FRONTEND_REPLICAS=2
```

Keep a copy in a password manager. Changing `JWT_SECRET` logs everyone
out. `TRUSTED_PROXY_COUNT` = proxies appending to `X-Forwarded-For`:
caddy + nginx = 2; one more for Cloudflare or a DO load balancer in
front.

To deploy from your own machine instead of CI, add
`REGISTRY=registry.digitalocean.com/<registry-name>` and
`DEPLOY_HOST=deploy@<public-ip>`, run `doctl registry login`, then
`scripts/deploy.sh`.

## 7. GitHub variables, environment and secrets

```bash
gh variable set -R PMNexa/goalnexa-cloud REGISTRY --body registry.digitalocean.com/<registry-name>
gh variable set -R PMNexa/goalnexa-cloud DEPLOY_HOST --body deploy@<public-ip>

# environment only the deploy branch may use
gh api -X PUT repos/PMNexa/goalnexa-cloud/environments/production \
  -F 'deployment_branch_policy[protected_branches]=false' \
  -F 'deployment_branch_policy[custom_branch_policies]=true'
gh api -X POST repos/PMNexa/goalnexa-cloud/environments/production/deployment-branch-policies -f name=deploy -f type=branch

gh secret set -R PMNexa/goalnexa-cloud PROD_ENV --env production < .env.production
gh secret set -R PMNexa/goalnexa-cloud DO_REGISTRY_TOKEN --env production          # paste the step 2 token
gh secret set -R PMNexa/goalnexa-cloud DEPLOY_SSH_KEY --env production < ~/.ssh/goalnexa_deploy
ssh-keyscan -t ed25519 <public-ip> | gh secret set -R PMNexa/goalnexa-cloud DEPLOY_KNOWN_HOSTS --env production
```

The variables must be repository-level: the workflow's `if` can't see
environment variables, and it skips itself while they're unset.

The `deploy` branch (in goalnexa-cloud) is protected (PR only, 0 approvals, CI checks
`backend`/`frontend`/`images` must pass and be up to date, admins
included, no force-push or delete). To recreate it:

```bash
gh api -X PUT repos/PMNexa/goalnexa-cloud/branches/deploy/protection --input - <<'EOF'
{
  "required_status_checks": {"strict": true, "checks": [
    {"context": "backend", "app_id": 15368},
    {"context": "frontend", "app_id": 15368},
    {"context": "images", "app_id": 15368}]},
  "enforce_admins": true,
  "required_pull_request_reviews": {"required_approving_review_count": 0},
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

## 8. DNS and firewall

1. At your DNS provider: **A** record `<app.yourdomain.com>` →
   `<public-ip>`. Caddy asks Let's Encrypt for the certificate on the
   first deploy, so the record must resolve by then (check with
   `dig +short <app.yourdomain.com>`).
2. DigitalOcean **Networking → Firewalls**, attached to the Droplet
   (use this, not `ufw` - Docker's published ports bypass `ufw`):
   - **SSH (22)**: from anywhere, key-only login (CI connects from
     changing GitHub runner IPs).
   - **HTTP (80)** and **HTTPS (443, TCP and UDP)**: from anywhere.
     Port 80 is needed for the certificate challenge and redirects to
     HTTPS.
   - Nothing else. The database is reached over the VPC.

## 9. First deploy

`main` and `deploy` start at the same commit, so run the workflow by
hand:

```bash
gh workflow run deploy.yml --ref deploy
gh run watch
```

The first run takes 5-10 minutes (empty build cache).

> **Right after it goes green, open `https://<app.yourdomain.com>` and
> finish `/auth/setup`.** The first account becomes app-wide Admin -
> until then, anyone who finds the site can claim it.

Check: `ssh deploy@<public-ip> docker service ls` - replicas 2/2, 2/2,
1/1.

## 10. Day to day

**Release** - in goalnexa-cloud: bring in the public repo's `main`
(the daily sync, or run it now), then a PR from `main` into `deploy`,
merged with a merge commit (a squash leaves `deploy` with a commit `main`
lacks, and they drift):

```bash
gh workflow run sync-upstream.yml -R PMNexa/goalnexa-cloud   # wait for it
gh pr create -R PMNexa/goalnexa-cloud --base deploy --head main --title "Release"
gh pr merge -R PMNexa/goalnexa-cloud --merge
```

Migrations run with the new image while the old one still serves, so a
migration must work with the previous release's code too (add a column
in one release, rely on it in the next).

**Roll back** to an earlier commit's images (uses the current
`docker-stack.yml` and `nginx/default.conf`):

```bash
gh workflow run deploy.yml --ref deploy -f tag=<12-char sha>
```

**Change a setting** - update `.env.production`, re-upload it
(`gh secret set -R PMNexa/goalnexa-cloud PROD_ENV --env production < .env.production`), then
re-run the latest tag as above.

**Clean up old images** now and then:
`doctl registry garbage-collection start` (CI does this on every build).

**Scale out**:

1. A second Droplet in the same VPC, set up as in step 3 but without
   `swarm init`.
2. Allow 2377/tcp, 7946/tcp+udp, 4789/udp between the nodes (VPC only).
3. On the manager: `docker swarm join-token worker`; run the printed
   command on the new node.
4. Raise `BACKEND_REPLICAS`/`FRONTEND_REPLICAS` and redeploy. Swarm
   spreads the replicas; Caddy on the manager reaches them over the
   overlay network, so no load balancer is needed yet.
5. When the manager itself is the limit (or must not be a single point
   of failure), move HTTPS to a DO Load Balancer or Cloudflare in front
   of every node, drop the `caddy` service, publish nginx's port 80
   (`mode: host`, `deploy.mode: global`) and set `TRUSTED_PROXY_COUNT`
   to 2 (+1 per extra proxy).

For high availability use 3 manager nodes (always an odd number). When
workers × nodes approach the database's connection limit (~22 on the
1 GB plan), enable its connection pool (PgBouncer) and point
`DATABASE_URL` at it.
