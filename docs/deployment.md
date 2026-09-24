# Deploying to DigitalOcean (Docker Swarm)

How production runs: one or more Droplets in a Docker Swarm
(`docker-stack.yml`), a managed Postgres, images in DigitalOcean's
container registry, Cloudflare in front. Merging a PR into the `deploy`
branch builds and rolls out the new version
(`.github/workflows/deploy.yml` → `scripts/deploy.sh`).

```
Cloudflare (DNS + TLS)
   │  port 80, Cloudflare IPs only
Droplet(s) ── Swarm: nginx (one per node) → main-backend ×2, main-frontend ×2
   │  VPC private network
Managed Postgres ── data + auth rate-limit cache
Container Registry ← GitHub Actions pushes images tagged with the commit
```

Replace `<...>` placeholders with your values. Use the same region for
everything.

## 1. Container registry

1. DigitalOcean → **Container Registry → Create**, name `goalnexa`.
2. Pick **Basic ($5/mo), not Starter** - Starter allows 1 repository and
   there are 2 (`goalnexa-backend`, `goalnexa-frontend`).
3. The registry is `registry.digitalocean.com/goalnexa`.

## 2. API token for CI

**API → Generate New Token**, name `goalnexa-ci`, custom scopes:
**registry: read + update** (and create, if offered). Keep it for step 7.

## 3. Droplet

1. **Create Droplet**: Ubuntu 24.04, 2 GB / 1 vCPU, your region, default
   VPC, your SSH key, **Monitoring** on.
2. Note its public IP and private (VPC) IP.
3. As root:

```bash
# Docker
curl -fsSL https://get.docker.com | sh

# 2 GB swap
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# deploy user (CI logs in as this)
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh

# Swarm, advertised on the PRIVATE IP
docker swarm init --advertise-addr <private-ip>
```

## 4. SSH key for CI

On your machine:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/goalnexa_deploy -N "" -C goalnexa-ci
ssh root@<public-ip> "cat >> /home/deploy/.ssh/authorized_keys && chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys" < ~/.ssh/goalnexa_deploy.pub

# accept the host key once, then check: should list the Swarm node
ssh deploy@<public-ip> true
docker -H ssh://deploy@<public-ip> node ls
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
DJANGO_ALLOWED_HOSTS=<app.yourdomain.com>
DJANGO_CSRF_TRUSTED_ORIGINS=https://<app.yourdomain.com>
DJANGO_HSTS_SECONDS=0
DATABASE_URL=postgresql://goalnexa:<pw>@<private-db-host>:25060/goalnexa?sslmode=require
TRUSTED_PROXY_COUNT=2
DEPLOYMENT_MODE=self_hosted
WEB_CONCURRENCY=3
BACKEND_REPLICAS=2
FRONTEND_REPLICAS=2
HTTP_PORT=80
```

Keep a copy in a password manager. Changing `JWT_SECRET` logs everyone
out. `TRUSTED_PROXY_COUNT` = proxies appending to `X-Forwarded-For`:
Cloudflare + nginx = 2, Cloudflare + a DO load balancer + nginx = 3.

To deploy from your own machine instead of CI, add
`REGISTRY=registry.digitalocean.com/goalnexa` and
`DEPLOY_HOST=deploy@<public-ip>`, run `doctl registry login`, then
`scripts/deploy.sh`.

## 7. GitHub variables, environment and secrets

```bash
gh variable set REGISTRY --body registry.digitalocean.com/goalnexa
gh variable set DEPLOY_HOST --body deploy@<public-ip>

# environment only the deploy branch may use
gh api -X PUT repos/PMNexa/GoalNexa/environments/production \
  -F 'deployment_branch_policy[protected_branches]=false' \
  -F 'deployment_branch_policy[custom_branch_policies]=true'
gh api -X POST repos/PMNexa/GoalNexa/environments/production/deployment-branch-policies -f name=deploy -f type=branch

gh secret set PROD_ENV --env production < .env.production
gh secret set DO_REGISTRY_TOKEN --env production          # paste the step 2 token
gh secret set DEPLOY_SSH_KEY --env production < ~/.ssh/goalnexa_deploy
ssh-keyscan -t ed25519 <public-ip> | gh secret set DEPLOY_KNOWN_HOSTS --env production
```

The variables must be repository-level: the workflow's `if` can't see
environment variables, and it skips itself while they're unset.

The `deploy` branch is protected (PR only, 0 approvals, CI checks
`backend`/`frontend`/`images` must pass and be up to date, admins
included, no force-push or delete). To recreate it:

```bash
gh api -X PUT repos/PMNexa/GoalNexa/branches/deploy/protection --input - <<'EOF'
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

## 8. Cloudflare and firewall

1. Cloudflare DNS: **A** record `app` → `<public-ip>`, **Proxied**.
2. SSL/TLS mode: **Flexible** to start.
3. DigitalOcean **Networking → Firewalls**, attached to the Droplet
   (use this, not `ufw` - Docker's published ports bypass `ufw`):
   - **SSH (22)**: from anywhere, key-only login (CI connects from
     changing GitHub runner IPs), or from your IP + GitHub's runner
     ranges.
   - **HTTP (80)**: only Cloudflare's ranges
     (https://www.cloudflare.com/ips/).

> **Security:** port 80 must accept Cloudflare only. Anyone reaching the
> Droplet directly can forge `X-Forwarded-For` and get past the login
> rate limits. "Flexible" also means Cloudflare → Droplet traffic,
> passwords included, is unencrypted: fine for a first test, then move to
> **Full (strict)** with a Cloudflare Origin Certificate (needs nginx on
> 443).

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

**Release** - PR from `main` into `deploy`, merged with a merge commit
(a squash leaves `deploy` with a commit `main` lacks, and they drift):

```bash
gh pr create --base deploy --head main --title "Release"
gh pr merge --merge
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
(`gh secret set PROD_ENV --env production < .env.production`), then
re-run the latest tag as above.

**Clean up old images** now and then:
`doctl registry garbage-collection start goalnexa`.

**Scale out**:

1. A second Droplet in the same VPC, set up as in step 3 but without
   `swarm init`.
2. Allow 2377/tcp, 7946/tcp+udp, 4789/udp between the nodes (VPC only).
3. On the manager: `docker swarm join-token worker`; run the printed
   command on the new node.
4. A DigitalOcean Load Balancer in front of both nodes (nginx runs on
   each); `TRUSTED_PROXY_COUNT=3` in `PROD_ENV` if Cloudflare stays in
   front.
5. Raise `BACKEND_REPLICAS`/`FRONTEND_REPLICAS` and redeploy.

For high availability use 3 manager nodes (always an odd number). When
workers × nodes approach the database's connection limit (~22 on the
1 GB plan), enable its connection pool (PgBouncer) and point
`DATABASE_URL` at it.
