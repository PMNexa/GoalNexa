#!/usr/bin/env bash
# Deploy to the Docker Swarm in docker-stack.yml. Runs from a laptop or
# CI (.github/workflows/deploy.yml); every remote step goes to the Swarm
# manager over SSH (`docker -H ssh://...`), nothing is copied to it.
#
#   scripts/deploy.sh          build + push images tagged with HEAD's
#                              commit (goalnexa:backend-<commit>,
#                              goalnexa:frontend-<commit>), then deploy
#   scripts/deploy.sh <tag>    deploy images already in the registry
#                              (CI after its own build, or a rollback to
#                              an earlier commit)
#
# Config: ENV_FILE (default .env.production) - the keys docker-stack.yml
# reads, plus REGISTRY (e.g. registry.digitalocean.com/goalnexa) and
# DEPLOY_HOST (user@manager-ip). Shell syntax: it is sourced.
# Needs: registry login (`doctl registry login`) and SSH access to
# DEPLOY_HOST; the local Docker CLI's registry credentials are passed on
# to the Swarm (--with-registry-auth).
#
# Order: migrate with the NEW image while the old one still serves, then
# roll out. So a migration must work with the code before it too (add a
# column in one release, start relying on it in the next).
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-.env.production}"
STACK_NAME="${STACK_NAME:-goalnexa}"

[ -f "$ENV_FILE" ] || { echo "No $ENV_FILE (set ENV_FILE)" >&2; exit 1; }
case "$ENV_FILE" in */*) ;; *) ENV_FILE="./$ENV_FILE" ;; esac
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
: "${REGISTRY:?set REGISTRY in $ENV_FILE}"
: "${DEPLOY_HOST:?set DEPLOY_HOST in $ENV_FILE}"

remote() { docker -H "ssh://$DEPLOY_HOST" "$@"; }

if [ $# -ge 1 ]; then
  IMAGE_TAG="$1"
else
  # Build exactly what's committed, submodules at their pinned commits.
  if [ -n "$(git status --porcelain)" ] && [ "${ALLOW_DIRTY:-}" != "1" ]; then
    echo "Uncommitted changes (ALLOW_DIRTY=1 to deploy anyway)" >&2
    exit 1
  fi
  IMAGE_TAG="$(git rev-parse HEAD | cut -c1-12)"
  # Droplets are amd64; a Mac builds arm64 by default.
  for image in backend frontend; do
    docker buildx build --platform linux/amd64 \
      -f "apps/main/$image/Dockerfile" \
      -t "$REGISTRY/goalnexa:$image-$IMAGE_TAG" \
      --push .
  done
fi
export IMAGE_TAG
export NGINX_CONF_VERSION="$(git hash-object nginx/default.conf | cut -c1-12)"
export CADDY_CONF_VERSION="$(git hash-object caddy/Caddyfile | cut -c1-12)"

echo "==> Migrating ($IMAGE_TAG)"
# `-e NAME` passes the value from this shell (sourced from ENV_FILE).
remote run --rm \
  -e DJANGO_DEBUG=false -e DJANGO_SECRET_KEY -e JWT_SECRET \
  -e DJANGO_ALLOWED_HOSTS -e DATABASE_URL -e DEPLOYMENT_MODE \
  -e GOALNEXA_EXTENSIONS \
  "$REGISTRY/goalnexa:backend-$IMAGE_TAG" \
  sh -c "python manage.py migrate --noinput && python manage.py createcachetable"

echo "==> Deploying stack $STACK_NAME ($IMAGE_TAG)"
remote stack deploy --with-registry-auth --prune --detach=false \
  -c docker-stack.yml "$STACK_NAME"

# A failed healthcheck rolls a service back instead of failing the
# command above - so check each app service really runs the new image,
# and CI goes red if one doesn't.
failed=0
for part in backend frontend; do
  service="main-$part"
  image="$(remote service inspect --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' "${STACK_NAME}_$service")"
  case "$image" in
    *":$part-$IMAGE_TAG"|*":$part-$IMAGE_TAG@"*) ;;
    *)
      echo "!! ${STACK_NAME}_$service runs $image, not $IMAGE_TAG (rolled back?)" >&2
      failed=1
      ;;
  esac
done
[ "$failed" -eq 0 ] || exit 1

echo "==> Deployed $IMAGE_TAG"
